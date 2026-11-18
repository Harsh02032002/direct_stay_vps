import React, { useMemo } from 'react';
import { Room, GuestCheckIn } from '../types';
import { BedDouble, SprayCan } from 'lucide-react';

export function isRoomDirty(r: Room): boolean {
  const cs = String((r as any).cleaningStatus || '').toLowerCase();
  return r.status === 'Dirty' || cs === 'dirty' || cs === 'in progress';
}

interface DirtyRoomsPanelProps {
  rooms: Room[];
  checkins?: GuestCheckIn[];
  className?: string;
}

/**
 * Lists every room that is currently Dirty / being cleaned so the audit
 * report (Daily Collection Sheet & Night Audit) always shows housekeeping state.
 */
export default function DirtyRoomsPanel({ rooms = [], checkins = [], className = '' }: DirtyRoomsPanelProps) {
  const dirtyRooms = useMemo(() => {
    return rooms
      .filter(isRoomDirty)
      .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }))
      .map(r => {
        const lastStay = checkins
          .filter(c => c.roomNumber === r.number && c.checkedOutDateTime)
          .sort((a, b) => String(b.checkedOutDateTime).localeCompare(String(a.checkedOutDateTime)))[0];
        const cs = String((r as any).cleaningStatus || '').toLowerCase();
        return {
          room: r,
          inProgress: cs === 'in progress' && r.status !== 'Dirty',
          lastGuest: lastStay?.guestName || '',
          lastOut: lastStay?.checkedOutDateTime ? String(lastStay.checkedOutDateTime).substring(0, 10) : ''
        };
      });
  }, [rooms, checkins]);

  return (
    <div className={`dirty-rooms-panel border rounded-2xl bg-white shadow-2xs overflow-hidden ${className}`}>
      <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-serif font-black uppercase tracking-wider text-rose-800">
          <SprayCan className="w-3.5 h-3.5" /> Dirty Rooms (Housekeeping Pending)
        </span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white border border-rose-300 text-rose-700">
          {dirtyRooms.length} of {rooms.length} rooms
        </span>
      </div>
      {dirtyRooms.length === 0 ? (
        <p className="text-xs text-emerald-700 font-semibold px-4 py-3">All rooms are clean &amp; ready. No dirty rooms.</p>
      ) : (
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="bg-rose-50/60 text-rose-900 uppercase text-[10px]">
              <th className="p-2 text-left border-b border-rose-100">Room</th>
              <th className="p-2 text-left border-b border-rose-100">Category</th>
              <th className="p-2 text-left border-b border-rose-100">Floor</th>
              <th className="p-2 text-left border-b border-rose-100">Status</th>
              <th className="p-2 text-left border-b border-rose-100">Last Guest (Checked Out)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-100">
            {dirtyRooms.map(({ room, inProgress, lastGuest, lastOut }) => (
              <tr key={room.id || room.number}>
                <td className="p-2 font-black text-luxury-brown-950">
                  <span className="inline-flex items-center gap-1"><BedDouble className="w-3 h-3 text-rose-500" />{room.number}</span>
                </td>
                <td className="p-2">{room.category || '-'}</td>
                <td className="p-2">{room.floor || '-'}</td>
                <td className="p-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${inProgress ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'}`}>
                    {inProgress ? 'Cleaning In Progress' : 'DIRTY'}
                  </span>
                </td>
                <td className="p-2">{lastGuest ? `${lastGuest}${lastOut ? ` (${lastOut})` : ''}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
