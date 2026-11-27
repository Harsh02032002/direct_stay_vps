import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

export interface GuestDeleteModalTarget {
  bookingId?: string;
  checkinId?: string;
  bookingRef?: string;
  guestName: string;
  mobile?: string;
  roomNumbers?: string[];
  contextLabel?: string; // e.g. "In-House Guest" or "Reservation"
}

interface GuestDeleteConfirmModalProps {
  target: GuestDeleteModalTarget | null;
  onCancel: () => void;
  onConfirm: (alsoRemoveGuestProfile: boolean) => void;
}

export const GuestDeleteConfirmModal: React.FC<GuestDeleteConfirmModalProps> = ({
  target,
  onCancel,
  onConfirm,
}) => {
  const [alsoRemoveProfile, setAlsoRemoveProfile] = useState(true);

  useEffect(() => {
    if (target) setAlsoRemoveProfile(true);
  }, [target]);

  if (!target) return null;

  const roomText = Array.from(
    new Set((target.roomNumbers || []).map((r) => String(r || '').trim()).filter(Boolean))
  ).join(', ');

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-rose-950">
                Delete {target.contextLabel || 'Guest Record'} Permanently?
              </h3>
              <p className="text-[11px] font-medium text-rose-700">
                This action cannot be undone
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-slate-700">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Guest Name:</span>
              <span className="font-extrabold text-slate-900">{target.guestName}</span>
            </div>
            {target.mobile && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Mobile:</span>
                <span className="font-mono font-bold text-slate-800">{target.mobile}</span>
              </div>
            )}
            {target.bookingRef && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Ref / ID:</span>
                <span className="font-mono font-bold text-slate-800">{target.bookingRef}</span>
              </div>
            )}
            {roomText && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Room(s):</span>
                <span className="font-bold text-slate-900">Room {roomText}</span>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 space-y-1">
            <p className="font-bold">All linked data will be permanently removed across the PMS:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-amber-900">
              <li>Reservation List &amp; In-House / Checked-Out stay records</li>
              <li>Linked Invoices, Payments, Reports &amp; Finance Vouchers</li>
              <li>Linked Room Food Orders (POS), Water Bottles, Laundry &amp; Services</li>
              <li>Room status will be reset to <strong>Available</strong> (if no other active guest is assigned)</li>
            </ul>
          </div>

          <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alsoRemoveProfile}
              onChange={(e) => setAlsoRemoveProfile(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span className="text-[11px] font-semibold text-slate-700">
              Also remove this guest&apos;s contact card from Guest Profiles directory
            </span>
          </label>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(alsoRemoveProfile)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestDeleteConfirmModal;
