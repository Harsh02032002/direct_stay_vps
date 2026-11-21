import React, { useState } from 'react';
import {
  CalendarDays,
  Clock,
  Users,
  Sun,
  Sunset,
  Moon,
  Save,
  CheckCircle2,
  Share2,
  Calendar
} from 'lucide-react';
import { Staff } from '../../types';
import { showToast } from '../../utils/toast';

interface StaffRosterViewProps {
  staff: Staff[];
  hotelName?: string;
  onAddAuditLog?: (action: string, details: string) => void;
}

export type ShiftType = 'Morning (7AM–3PM)' | 'Evening (3PM–11PM)' | 'Night (11PM–7AM)' | 'Off';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function StaffRosterView({
  staff = [],
  hotelName = 'DirectStay Hotel',
  onAddAuditLog,
}: StaffRosterViewProps) {
  const [currentWeek, setCurrentWeek] = useState('Week 47 — Nov 2026');

  // Weekly roster mapping: staffId -> { day -> ShiftType }
  const [rosterData, setRosterData] = useState<Record<string, Record<string, ShiftType>>>(() => {
    const initial: Record<string, Record<string, ShiftType>> = {};
    staff.forEach((s, idx) => {
      initial[s.id] = {};
      DAYS_OF_WEEK.forEach((day, dIdx) => {
        if (dIdx === (idx % 7)) {
          initial[s.id][day] = 'Off';
        } else if (s.designation?.toLowerCase().includes('night') || idx % 3 === 2) {
          initial[s.id][day] = 'Night (11PM–7AM)';
        } else if (idx % 3 === 1) {
          initial[s.id][day] = 'Evening (3PM–11PM)';
        } else {
          initial[s.id][day] = 'Morning (7AM–3PM)';
        }
      });
    });
    return initial;
  });

  const handleShiftChange = (staffId: string, day: string, newShift: ShiftType) => {
    setRosterData((prev) => ({
      ...prev,
      [staffId]: {
        ...(prev[staffId] || {}),
        [day]: newShift,
      },
    }));
  };

  const handleSaveRoster = () => {
    const log = `Weekly shift roster saved for ${staff.length} staff members (${currentWeek}).`;
    onAddAuditLog?.('Shift Roster Updated', log);
    showToast('Weekly shift schedule published & synced to staff portals!', 'success', 4000, 'Roster Published');
  };

  const shiftBadge = (shift: ShiftType) => {
    switch (shift) {
      case 'Morning (7AM–3PM)':
        return 'bg-amber-50 text-amber-900 border-amber-200';
      case 'Evening (3PM–11PM)':
        return 'bg-blue-50 text-blue-900 border-blue-200';
      case 'Night (11PM–7AM)':
        return 'bg-purple-50 text-purple-900 border-purple-200';
      case 'Off':
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-blue-600" /> Shift Timings &amp; Duty Roster
          </div>
          <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            Weekly Shift Roster &amp; Allocation
          </h2>
          <p className="text-xs text-luxury-brown-500 mt-0.5">
            Organize Morning, Evening, and Night duty assignments across front desk, housekeeping, and kitchen for {hotelName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveRoster}
            className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> Publish Roster
          </button>
        </div>
      </div>

      {/* Shifts Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-amber-200 p-4 rounded-2xl shadow-3xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-luxury-brown-950">Morning Shift</h4>
              <p className="text-[11px] font-mono text-luxury-brown-500">07:00 AM – 03:00 PM</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg">8 Hours</span>
        </div>

        <div className="bg-white border border-blue-200 p-4 rounded-2xl shadow-3xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
              <Sunset className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-luxury-brown-950">Evening Shift</h4>
              <p className="text-[11px] font-mono text-luxury-brown-500">03:00 PM – 11:00 PM</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg">8 Hours</span>
        </div>

        <div className="bg-white border border-purple-200 p-4 rounded-2xl shadow-3xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-luxury-brown-950">Night Audit Shift</h4>
              <p className="text-[11px] font-mono text-luxury-brown-500">11:00 PM – 07:00 AM</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg">8 Hours</span>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-luxury-brown-50">
          <span className="text-xs font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            <Users className="w-4 h-4 text-luxury-gold-600" />
            Weekly Staff Schedule Matrix
          </span>
          <span className="text-[11px] font-mono font-bold text-luxury-brown-600 bg-luxury-beige-100 px-3 py-1 rounded-lg">
            {currentWeek}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-luxury-brown-100 text-[10px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/70">
                <th className="py-2.5 px-4 min-w-[160px]">Staff &amp; Dept</th>
                {DAYS_OF_WEEK.map((day) => (
                  <th key={day} className="py-2.5 px-3 text-center min-w-[110px]">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-luxury-brown-100">
              {staff.map((s) => {
                const staffWeek = rosterData[s.id] || {};
                return (
                  <tr key={s.id} className="hover:bg-luxury-beige-50/40">
                    <td className="py-3 px-4">
                      <div className="font-bold text-luxury-brown-950">{s.name}</div>
                      <div className="text-[10px] font-mono text-luxury-brown-500">{s.department} • {s.designation}</div>
                    </td>
                    {DAYS_OF_WEEK.map((day) => {
                      const cur = staffWeek[day] || 'Morning (7AM–3PM)';
                      return (
                        <td key={day} className="py-2 px-2 text-center">
                          <select
                            value={cur}
                            onChange={(e) => handleShiftChange(s.id, day, e.target.value as ShiftType)}
                            className={`w-full py-1 px-1.5 rounded-lg border text-[10px] font-mono font-bold cursor-pointer transition-colors ${shiftBadge(
                              cur
                            )}`}
                          >
                            <option value="Morning (7AM–3PM)">Morning (7-3)</option>
                            <option value="Evening (3PM–11PM)">Evening (3-11)</option>
                            <option value="Night (11PM–7AM)">Night (11-7)</option>
                            <option value="Off">Week Off</option>
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
