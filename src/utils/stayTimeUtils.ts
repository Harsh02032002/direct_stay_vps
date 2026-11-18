import { HotelSettings } from '../types';

export const getCurrentTimeStr = (): string => {
  const d = new Date();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:${minutes} ${ampm}`;
};

export const parseTimeToMinutes = (timeStr?: string): number => {
  if (!timeStr || !timeStr.trim()) return 12 * 60; // default 12:00 PM
  const cleaned = timeStr.trim();

  // Try 24h format like "14:30"
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    return Math.min(24 * 60, Math.max(0, h * 60 + m));
  }

  // Try 12h format like "02:30 PM", "2:30pm", "10 AM", "12:00 PM"
  const match12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match12) return 12 * 60;

  let h = parseInt(match12[1], 10);
  const m = match12[2] ? parseInt(match12[2], 10) : 0;
  const ampm = (match12[3] || '').toUpperCase();

  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;

  return Math.min(24 * 60, Math.max(0, h * 60 + m));
};

export interface EarlyCheckInResult {
  isEarly: boolean;
  earlyHours: number;
  chargeAmount: number;
  standardTime: string;
  reason: string;
}

export const calculateEarlyCheckIn = (
  checkInTimeStr?: string,
  hotelSettings?: HotelSettings
): EarlyCheckInResult => {
  const standardTime = hotelSettings?.checkInTime?.trim() || '12:00 PM';
  if (hotelSettings?.earlyCheckInEnabled === false) {
    return { isEarly: false, earlyHours: 0, chargeAmount: 0, standardTime, reason: '' };
  }

  const checkInMin = parseTimeToMinutes(checkInTimeStr || getCurrentTimeStr());
  const standardMin = parseTimeToMinutes(standardTime);

  if (checkInMin < standardMin) {
    const diffMin = standardMin - checkInMin;
    const earlyHours = Math.max(1, Math.ceil(diffMin / 60));
    const pricingType = hotelSettings?.earlyCheckInType || 'hourly';

    let chargeAmount = 0;
    if (pricingType === 'hourly') {
      const hourlyRate = Math.max(0, Number(hotelSettings?.earlyCheckInHourlyRate) || 0);
      chargeAmount = earlyHours * hourlyRate;
    } else {
      chargeAmount = Math.max(0, Number(hotelSettings?.earlyCheckInFixedRate) || 0);
    }

    return {
      isEarly: true,
      earlyHours,
      chargeAmount,
      standardTime,
      reason: `Arrived ${earlyHours} hr(s) before standard check-in (${standardTime})`
    };
  }

  return { isEarly: false, earlyHours: 0, chargeAmount: 0, standardTime, reason: '' };
};

export interface StayDurationResult {
  nights: number;
  isSameDay: boolean;
  durationHours: number;
  durationLabel: string;
}

export const calculateStayDuration = (
  checkInDate: string,
  checkInTime: string,
  checkOutDate: string,
  checkOutTime: string
): StayDurationResult => {
  if (!checkInDate || !checkOutDate) {
    return { nights: 1, isSameDay: false, durationHours: 24, durationLabel: '1 Night' };
  }

  const isSameDay = checkInDate === checkOutDate;
  if (isSameDay) {
    const startMin = parseTimeToMinutes(checkInTime);
    const endMin = parseTimeToMinutes(checkOutTime);
    const diffMin = endMin > startMin ? endMin - startMin : 120; // default 2 hrs if not specified or backward
    const hours = Math.max(1, Math.round(diffMin / 60));
    return {
      nights: 1, // charged as 1 day/short stay
      isSameDay: true,
      durationHours: hours,
      durationLabel: `Same-Day Short Stay (${hours} Hours)`
    };
  }

  const d1 = new Date(checkInDate);
  const d2 = new Date(checkOutDate);
  const diffDays = Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  const nights = Math.max(1, isNaN(diffDays) ? 1 : diffDays);
  return {
    nights,
    isSameDay: false,
    durationHours: nights * 24,
    durationLabel: `${nights} Night(s)`
  };
};
