import React, { useState, useEffect } from 'react';
import { X, Utensils } from 'lucide-react';
import { BookingRecord } from '../types';

interface AddRoomOrderModalProps {
  booking: BookingRecord | null;
  onClose: () => void;
  onProceedToPos: (booking: BookingRecord, selectedRoomNumber: string, orderNo: string) => void;
}

export default function AddRoomOrderModal({
  booking,
  onClose,
  onProceedToPos,
}: AddRoomOrderModalProps) {
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [orderNo, setOrderNo] = useState<string>('#780');

  useEffect(() => {
    if (booking) {
      setSelectedRoom(booking.roomNumbers[0] || '102');
      setOrderNo(`#${Math.floor(780 + Math.random() * 190)}`);
    }
  }, [booking]);

  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        {/* Header matching video 07:15 "Add Order" */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-[#FBF4E0]">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-[#C49A3A]" />
            <h3 className="text-sm font-bold text-[#17120F]">Add Order (Room Service)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/10 text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-12 gap-3 items-center text-xs">
            <div className="col-span-3">
              <span className="text-slate-500 block text-[11px] font-bold">NO.</span>
              <strong className="font-mono text-sm text-slate-900">{orderNo}</strong>
            </div>
            <div className="col-span-4">
              <span className="text-slate-500 block text-[11px] font-bold">Customer Name</span>
              <strong className="text-sm text-slate-900">{booking.customerName}</strong>
            </div>
            <div className="col-span-5">
              <span className="text-slate-500 block text-[11px] font-bold mb-1">Rooms</span>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
              >
                {booking.roomNumbers.map((rn) => (
                  <option key={rn} value={rn}>
                    Room {rn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase rounded-xl cursor-pointer"
            >
              CLOSE
            </button>
            <button
              type="button"
              onClick={() => onProceedToPos(booking, selectedRoom, orderNo)}
              className="py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white text-xs font-bold uppercase rounded-xl shadow-md cursor-pointer"
            >
              ADD & OPEN POS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
