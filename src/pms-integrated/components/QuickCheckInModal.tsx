import React, { useEffect, useState } from 'react';
import { X, Plus, Upload, UserCheck, Trash2, CheckCircle2, Lock, AlertTriangle, Clock } from 'lucide-react';
import { BookingRecord, GuestPerson, RoomAsset } from '../types';
import { showToast } from '../../utils/toast';
import { SAMPLE_AADHAAR_SVG_URL } from '../mock-data/initialData';
import { useHotelTaxSettings } from '../utils/taxSettings';
import { BillSettings, normalizeBillSettings } from '../../utils/billCalculator';

interface QuickCheckInModalProps {
  booking: BookingRecord | null;
  rooms?: RoomAsset[];
  currentRole?: string;
  loggedInUser?: string;
  hasExistingInvoice?: boolean;
  billSettings?: BillSettings;
  allowBackDatedCheckIn?: boolean;
  onClose: () => void;
  onLogOverride?: (details: string) => void;
  onConfirmCheckIn: (
    bookingId: string,
    guests: GuestPerson[],
    checkInTimeStr: string,
    withGst?: boolean,
    gstRate?: number
  ) => void;
}

function getCurrentHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function QuickCheckInModal({
  booking,
  rooms = [],
  currentRole = 'Admin',
  loggedInUser = 'Front Desk',
  hasExistingInvoice = false,
  billSettings,
  allowBackDatedCheckIn = false,
  onClose,
  onLogOverride,
  onConfirmCheckIn,
}: QuickCheckInModalProps) {
  const [taxSettings] = useHotelTaxSettings();
  const settings = billSettings || normalizeBillSettings(taxSettings);
  const configuredGstRate = settings.roomGstRate;

  const [guests, setGuests] = useState<GuestPerson[]>([]);
  const [fillCustomerInfo, setFillCustomerInfo] = useState(true);
  const [checkInDateInput, setCheckInDateInput] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [checkInTimeInput, setCheckInTimeInput] = useState(() => getCurrentHHMM());
  const [withGst, setWithGst] = useState<boolean>(true);
  const [overrideApproved, setOverrideApproved] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const canAuthoriseOverride = ['SuperAdmin', 'Owner', 'Admin', 'Manager'].includes(
    String(currentRole || '')
  );

  useEffect(() => {
    if (!booking) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    setCheckInDateInput(booking.isCheckedIn ? booking.checkInDate || todayIso : todayIso);
    if (booking.isCheckedIn && booking.checkInTime) {
      const m = booking.checkInTime.match(/(\d{1,2}):(\d{2})/);
      if (m) {
        let hh = Number(m[1]);
        const mm = m[2];
        if (/pm/i.test(booking.checkInTime) && hh < 12) hh += 12;
        if (/am/i.test(booking.checkInTime) && hh === 12) hh = 0;
        setCheckInTimeInput(`${String(hh).padStart(2, '0')}:${mm}`);
      } else {
        setCheckInTimeInput(getCurrentHHMM());
      }
    } else {
      setCheckInTimeInput(getCurrentHHMM());
    }

    const isWithTax = Boolean(booking.gstInvoice && Number(booking.taxRate ?? configuredGstRate) > 0);
    setWithGst(isWithTax);

    if (Array.isArray(booking.guests) && booking.guests.length > 0) {
      setGuests(
        booking.guests.map((g, idx) => ({
          ...g,
          name: g.name || (idx === 0 ? booking.customerName : ''),
          phone: g.phone || (idx === 0 ? booking.mobile : ''),
          email: g.email || (idx === 0 ? booking.email : ''),
          documentType: g.documentType || 'Aadhaar Card',
          documentNumber: g.documentNumber || '',
        }))
      );
    } else {
      setGuests([
        {
          id: `gst-${Date.now()}`,
          name: booking.customerName || '',
          phone: booking.mobile || '',
          email: booking.email || '',
          gender: 'Male',
          age: 28,
          dob: '1998-01-01',
          isAdult: true,
          documentType: 'Aadhaar Card',
          documentNumber: '',
        },
      ]);
    }
  }, [booking, configuredGstRate]);

  if (!booking) return null;

  const safeRooms =
    Array.isArray(booking.roomNumbers) && booking.roomNumbers.length > 0
      ? booking.roomNumbers
      : ['101'];

  const handleAddGuestRow = () => {
    setGuests((prev) => [
      ...prev,
      {
        id: `gst-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: '',
        phone: booking.mobile,
        email: '',
        gender: 'Female',
        age: 25,
        dob: '2001-01-01',
        isAdult: true,
        documentType: 'Aadhaar Card',
        documentNumber: '',
      },
    ]);
  };

  const handleUpdateGuest = (idx: number, patch: Partial<GuestPerson>) => {
    setGuests((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  };

  const handleRemoveGuest = (idx: number) => {
    if (guests.length <= 1) return;
    setGuests((prev) => prev.filter((_, i) => i !== idx));
  };

  const lockedRate = Number(booking.taxRate) > 0 ? Number(booking.taxRate) : configuredGstRate;
  const effectiveGstRate = hasExistingInvoice
    ? withGst
      ? lockedRate
      : 0
    : withGst
    ? configuredGstRate
    : 0;

  const unreadyRooms = !booking.isCheckedIn
    ? safeRooms
        .map((rn) => rooms.find((r) => r.number === rn))
        .filter((r): r is RoomAsset =>
          Boolean(
            r &&
              (r.status === 'Out of Service' ||
                r.status === 'Dirty' ||
                r.cleaningStatus !== 'Clean')
          )
        )
    : [];

  const handleConfirm = () => {
    if (unreadyRooms.length > 0) {
      const desc = unreadyRooms
        .map((r) => `Room ${r.number} (${r.status === 'Out of Service' ? 'Out of Order' : r.cleaningStatus})`)
        .join(', ');
      if (!canAuthoriseOverride) {
        showToast(
          `Check-In Blocked: ${desc} is not Clean/Ready. Please mark it Clean in Housekeeping or request Manager/Admin override.`,
          'error'
        );
        return;
      }
      if (!overrideApproved || !overrideReason.trim()) {
        showToast(
          `Authorised Override Required: Confirm override checkbox and enter a reason for ${desc}.`,
          'warning'
        );
        return;
      }
      onLogOverride?.(
        `${loggedInUser} (${currentRole}) authorised check-in override on ${desc} for Booking #${booking.bookingNo}. Reason: ${overrideReason.trim()}`
      );
    }
    const datePart = checkInDateInput || new Date().toISOString().slice(0, 10);
    const timePart = checkInTimeInput || getCurrentHHMM();
    const formattedTime = `${datePart}, ${timePart}`;
    onConfirmCheckIn(booking.id, guests, formattedTime, withGst, effectiveGstRate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-[#FBF4E0]">
          <div>
            <h3 className="text-sm font-bold text-[#17120F]">
              {booking.isCheckedIn
                ? `Manage Guests & Identity Documents (${booking.bookingNo})`
                : 'Confirm Guest Check-In & Identity Verification'}
            </h3>
            <p className="text-xs text-slate-600">
              Booking #{booking.bookingNo} • Rooms: {safeRooms.join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddGuestRow}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-[#C49A3A] text-[#8B691E] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> ADD GUEST
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-black/10 text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Guest Info & Identity Proofs ({guests.length})
            </span>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={fillCustomerInfo}
                onChange={(e) => {
                  setFillCustomerInfo(e.target.checked);
                  if (e.target.checked && guests[0]) {
                    handleUpdateGuest(0, {
                      name: booking.customerName,
                      phone: booking.mobile,
                      email: booking.email,
                    });
                  }
                }}
              />
              <span>Fill Customer Info</span>
            </label>
          </div>

          {/* 🕒 Arrival Date & Back-Time Input */}
          <div className="p-3.5 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/60 via-stone-50 to-amber-50/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#17120F] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#C49A3A]" /> Check-In Date & Arrival Time
                {allowBackDatedCheckIn && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-mono font-bold">
                    Back-Time Active
                  </span>
                )}
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {checkInDateInput} at {checkInTimeInput}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-1">
                  Arrival Date
                </label>
                <input
                  type="date"
                  min={!allowBackDatedCheckIn ? new Date().toISOString().slice(0, 10) : undefined}
                  value={checkInDateInput}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    const todayStr = new Date().toISOString().slice(0, 10);
                    if (!allowBackDatedCheckIn && nextVal < todayStr) {
                      showToast('Past arrival date blocked. Enable back-dated check-in in Property Setup.', 'warning');
                      return;
                    }
                    setCheckInDateInput(nextVal);
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white focus:outline-none focus:border-[#C49A3A]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-1">
                  Arrival Time (Back-Time)
                </label>
                <input
                  type="time"
                  value={checkInTimeInput}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const nowHhmm = getCurrentHHMM();
                    if (!allowBackDatedCheckIn && checkInDateInput === todayStr && nextVal < nowHhmm) {
                      showToast('Past arrival time blocked. Enable back-dated check-in in Property Setup.', 'warning');
                      return;
                    }
                    setCheckInTimeInput(nextVal);
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white focus:outline-none focus:border-[#C49A3A]"
                />
              </div>
            </div>
          </div>

          {guests.map((g, idx) => {
            const hasUploadedImg = Boolean(
              g.documentImageUrl && g.documentImageUrl !== SAMPLE_AADHAAR_SVG_URL
            );
            return (
              <div
                key={g.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#17120F]">
                      Guest #{idx + 1} {idx === 0 ? '(Primary)' : '(Co-Guest)'}
                    </span>
                    {hasUploadedImg && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ID Scan Attached
                      </span>
                    )}
                  </div>
                  {guests.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveGuest(idx)}
                      className="text-xs text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Name*
                    </label>
                    <input
                      type="text"
                      value={g.name}
                      onChange={(e) => handleUpdateGuest(idx, { name: e.target.value })}
                      placeholder="Guest Full Name"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={g.phone}
                      onChange={(e) => handleUpdateGuest(idx, { phone: e.target.value })}
                      placeholder="Mobile Number"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={g.email}
                      onChange={(e) => handleUpdateGuest(idx, { email: e.target.value })}
                      placeholder="Email"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Gender
                    </label>
                    <select
                      value={g.gender}
                      onChange={(e) =>
                        handleUpdateGuest(idx, { gender: e.target.value as GuestPerson['gender'] })
                      }
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      DOB / Age
                    </label>
                    <input
                      type="date"
                      value={g.dob}
                      onChange={(e) => handleUpdateGuest(idx, { dob: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ID Proof Type
                    </label>
                    <select
                      value={g.documentType}
                      onChange={(e) =>
                        handleUpdateGuest(idx, {
                          documentType: e.target.value as GuestPerson['documentType'],
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                    >
                      <option value="Aadhaar Card">Aadhaar Card</option>
                      <option value="Pan Card">Pan Card</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Voter Id Card">Voter Id Card</option>
                      <option value="Passport">Passport</option>
                      <option value="Visa">Visa</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <input
                    type="text"
                    value={g.documentNumber}
                    onChange={(e) => handleUpdateGuest(idx, { documentNumber: e.target.value })}
                    placeholder="Enter Aadhaar / Passport / ID Number"
                    className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono font-bold"
                  />
                  <label className="px-3 py-1.5 bg-[#FBF4E0] hover:bg-[#F6E9C8] text-[#8B691E] border border-[#C49A3A]/40 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{hasUploadedImg ? 'Change ID Scan ✓' : 'Upload ID Scan'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            handleUpdateGuest(idx, { documentImageUrl: reader.result });
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>

                {g.documentImageUrl && (
                  <div className="mt-2 p-2 rounded-lg bg-white border border-slate-200 flex items-center gap-3">
                    <img
                      src={g.documentImageUrl}
                      alt={g.documentType}
                      className="w-20 h-14 object-cover rounded border border-slate-200 shrink-0"
                    />
                    <div className="text-[11px] text-slate-600 flex-1">
                      <div className="font-bold text-slate-800">
                        {g.documentType} {g.documentNumber ? `— ${g.documentNumber}` : ''}
                      </div>
                      <div className="text-emerald-700 font-semibold">
                        ✓ Guest ID document ready for GRC & Police C-Form archive
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Single Clean Checkbox: GST Invoice */}
          <div className="pt-3 border-t border-slate-200">
            {hasExistingInvoice ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">Billing Tax Mode</span>
                  <span className="text-[11px] text-slate-500">
                    Invoice already generated — GST mode is locked
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${
                    withGst
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Locked: {withGst ? `GST Invoice (${lockedRate}%)` : 'Without GST (0%)'}
                </span>
              </div>
            ) : (
              <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={withGst}
                    onChange={(e) => setWithGst(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <div>
                    <span className="text-xs font-extrabold text-slate-900">
                      GST Invoice
                    </span>
                    <p className="text-[11px] text-slate-600">
                      {withGst
                        ? `Applies ${configuredGstRate}% GST automatically from Profile Settings`
                        : '0% Without GST (Bill of Supply)'}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${
                    withGst
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {withGst ? `${configuredGstRate}% GST` : '0% No GST'}
                </span>
              </label>
            )}
          </div>

          {/* Check In Date & Time (Auto-captured current date & time) */}
          <div className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Check-In Date & Time (Auto-Captured)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={checkInDateInput}
                onChange={(e) => setCheckInDateInput(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold"
              />
              <input
                type="time"
                value={checkInTimeInput}
                onChange={(e) => setCheckInTimeInput(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold"
              />
            </div>
          </div>

          {unreadyRooms.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2 text-xs">
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Housekeeping / Readiness Alert:{' '}
                  {unreadyRooms
                    .map(
                      (r) =>
                        `Room ${r.number} (${r.status === 'Out of Service' ? 'Out of Order' : r.cleaningStatus})`
                    )
                    .join(', ')}
                </span>
              </div>
              {canAuthoriseOverride ? (
                <>
                  <label className="flex items-center gap-2 font-semibold text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideApproved}
                      onChange={(e) => setOverrideApproved(e.target.checked)}
                      className="accent-amber-600"
                    />
                    <span>Authorise Room Readiness Override ({currentRole})</span>
                  </label>
                  {overrideApproved && (
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Mandatory override reason..."
                      className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs"
                    />
                  )}
                </>
              ) : (
                <p className="text-[11px] text-rose-700 font-semibold">
                  Check-in is blocked until Housekeeping marks the room Clean &amp; Ready, or a Manager/Admin authorises an override.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold uppercase rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white text-xs font-bold uppercase rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>{booking.isCheckedIn ? 'Save Guests & ID Docs' : 'Check In'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
