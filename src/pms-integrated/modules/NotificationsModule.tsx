import React from 'react';
import { Bell, CheckCheck, ArrowUpRight, Sparkles, CreditCard, CalendarCheck } from 'lucide-react';
import { NotificationEntry } from '../types';

interface NotificationsModuleProps {
  notifications: NotificationEntry[];
  onMarkAllRead: () => void;
  onNavigate: (module: string, subTab?: string) => void;
}

export const NotificationsModule: React.FC<NotificationsModuleProps> = ({
  notifications,
  onMarkAllRead,
  onNavigate,
}) => {
  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            Real-Time PMS Operations Notifications Center
          </h1>
          <p className="text-xs text-slate-500">
            Instant alerts for OTA Bookings, Check-In/Out, POS Room Service KOTs & Housekeeping Turnaround
          </p>
        </div>

        <button
          onClick={onMarkAllRead}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center gap-1.5"
        >
          <CheckCheck className="w-4 h-4" />
          Mark All Read
        </button>
      </div>

      <div className="space-y-3">
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => onNavigate(n.targetModule, n.targetSubTab)}
            className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-4 ${
              n.isRead
                ? 'bg-white border-slate-200/80 hover:border-slate-300'
                : 'bg-amber-50/50 border-amber-300 shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  n.severity === 'success'
                    ? 'bg-emerald-100 text-emerald-700'
                    : n.severity === 'warning'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {n.type === 'payment' ? (
                  <CreditCard className="w-5 h-5" />
                ) : n.type === 'housekeeping' ? (
                  <Sparkles className="w-5 h-5" />
                ) : (
                  <CalendarCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{n.title}</span>
                  {!n.isRead && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px]">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                <span className="text-[10px] text-slate-400 font-medium">{n.createdAt}</span>
              </div>
            </div>

            <button className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 shrink-0">
              Open <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
