import { Booking } from '../types';

export type BookingEmailEventType =
  | 'booking_confirmation'
  | 'booking_updated'
  | 'booking_cancelled'
  | 'checkin_confirmation';

export interface SendBookingEmailPayload {
  hotelId: string;
  hotelName?: string;
  eventType: BookingEmailEventType;
  bookingId: string;
  guestName: string;
  recipientEmail: string;
  mobile?: string;
  roomNumber?: string;
  roomType?: string;
  checkInDate: string;
  checkOutDate?: string;
  nights?: number;
  totalAmount?: number;
  advanceAmount?: number;
  pendingAmount?: number;
  status?: string;
  cancellationReason?: string;
  dryRun?: boolean;
  forceResend?: boolean;
}

export interface SendBookingEmailResult {
  success: boolean;
  delivered: boolean;
  dryRun?: boolean;
  status: string;
  logId?: string;
  subject?: string;
  reason?: string;
  error?: string;
}

const TEST_EMAIL_REGEX = /@(example\.(com|org|net)|localhost|test\.local)$|\.(test|invalid|example)$/i;

export function isValidEmailAddress(email?: string): boolean {
  const clean = String(email || '').trim();
  if (!clean || clean.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean);
}

export function isTestOrSafeEmail(email?: string): boolean {
  const clean = String(email || '').trim().toLowerCase();
  return TEST_EMAIL_REGEX.test(clean) || clean.startsWith('qa-test') || clean.startsWith('test-');
}

export async function triggerBookingEmail(
  booking: Booking,
  options: {
    hotelId?: string;
    hotelName?: string;
    eventType?: BookingEmailEventType;
    dryRun?: boolean;
    forceResend?: boolean;
  } = {}
): Promise<SendBookingEmailResult> {
  const recipientEmail = String(booking.email || '').trim();
  if (!isValidEmailAddress(recipientEmail)) {
    return {
      success: false,
      delivered: false,
      status: 'skipped_invalid_email',
      error: 'Valid guest email address is required to send booking email.',
    };
  }

  const resolvedHotelId =
    options.hotelId ||
    booking.hotelId ||
    (typeof window !== 'undefined'
      ? sessionStorage.getItem('pms_selected_hotel_id') || localStorage.getItem('pms_selected_hotel_id') || 'hotel-1'
      : 'hotel-1');

  const token =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('pms_session_token') || localStorage.getItem('pms_session_token') || ''
      : '';
  const role =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('pms_role') || localStorage.getItem('pms_role') || 'Admin'
      : 'Admin';
  const user =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('pms_user') || localStorage.getItem('pms_user') || 'Front Desk'
      : 'Front Desk';

  const totalAmount = Number(booking.bookingAmount || 0) + Number(booking.gstAmount || 0);
  const advanceAmount = Number(booking.advanceAmount || 0);
  const pendingAmount = Math.max(0, totalAmount - advanceAmount);
  const safeDryRun = Boolean(options.dryRun || isTestOrSafeEmail(recipientEmail));

  const payload: SendBookingEmailPayload = {
    hotelId: resolvedHotelId,
    hotelName: options.hotelName || 'DirectStay Partner Hotel',
    eventType: options.eventType || 'booking_confirmation',
    bookingId: booking.id,
    guestName: booking.guestName,
    recipientEmail,
    mobile: booking.mobile,
    roomNumber: booking.roomNumber || 'Assigned at Check-In',
    roomType: booking.roomType || 'Standard',
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate || '',
    nights: Number(booking.nights) || 1,
    totalAmount,
    advanceAmount,
    pendingAmount,
    status: booking.status,
    cancellationReason: booking.cancellationReason,
    dryRun: safeDryRun,
    forceResend: Boolean(options.forceResend),
  };

  try {
    const resp = await fetch('/api/bookings/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
        'x-user-role': role,
        'x-hotel-id': resolvedHotelId,
        'x-target-hotel-id': resolvedHotelId,
        'x-user-name': user,
        ...(safeDryRun ? { 'x-email-dry-run': 'true' } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data?.success === false) {
      return {
        success: false,
        delivered: false,
        status: data?.status || 'failed',
        error: data?.error || `Email API returned HTTP ${resp.status}`,
      };
    }
    return {
      success: true,
      delivered: Boolean(data.delivered),
      dryRun: Boolean(data.dryRun),
      status: data.status || 'logged',
      logId: data.log?.id,
      subject: data.log?.subject,
      reason: data.reason,
    };
  } catch (err: any) {
    return {
      success: false,
      delivered: false,
      status: 'network_error',
      error: err?.message || 'Unable to reach booking email service',
    };
  }
}
