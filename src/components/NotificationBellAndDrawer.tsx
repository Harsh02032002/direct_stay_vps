import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  Building2,
  ShieldCheck,
  Calendar,
  CreditCard,
  FileText,
  UserCheck,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Clock,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { AppNotification, UserRole } from '../types';

interface NotificationBellAndDrawerProps {
  notifications: AppNotification[];
  currentRole: UserRole;
  selectedHotelId: string;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateLink?: (path: string) => void;
  onOpenNotification?: (notification: AppNotification) => void;
  isLoading?: boolean;
  error?: string | null;
  isRealtimeConnected?: boolean;
  onRefresh?: () => void;
}

export function resolveNotificationActionLink(
  notif: AppNotification,
  currentRole: UserRole
): string | undefined {
  const titleLower = (notif.title || '').toLowerCase();
  const msgLower = (notif.message || '').toLowerCase();

  if (currentRole === 'SuperAdmin') {
    if (notif.linkPath && notif.linkPath.startsWith('/superadmin')) return notif.linkPath;
    if (notif.type === 'registration' || notif.type === 'approval' || notif.type === 'suspension') {
      return '/superadmin/hotels';
    }
    if (notif.type === 'subscription' || notif.type === 'payment') {
      return '/superadmin/subscriptions';
    }
    return '/superadmin/hotels';
  }

  if (currentRole === 'Owner') {
    if (notif.linkPath && notif.linkPath.startsWith('/hotelowner')) return notif.linkPath;
    switch (notif.type) {
      case 'booking':
      case 'checkin':
      case 'checkout':
        return '/hotelowner/bookings';
      case 'invoice':
      case 'payment':
      case 'expense':
        return '/hotelowner/financials';
      case 'subscription':
        return '/hotelowner/subscription';
      case 'staff':
        return '/hotelowner/staff';
      case 'registration':
      case 'approval':
      case 'suspension':
        return '/hotelowner/property';
      default:
        return '/hotelowner/dashboard';
    }
  }

  // Hotel Admin & operational roles — map directly to the exact active module/sub-tab
  switch (notif.type) {
    case 'booking':
      return '/admin/frontDesk/reservations';
    case 'checkin':
      return '/admin/frontDesk/inhouse';
    case 'checkout':
      return '/admin/frontDesk/checkout';
    case 'invoice':
      return '/admin/frontDesk/billing';
    case 'payment':
      return '/admin/finance/transactions';
    case 'expense':
      return '/admin/expenses';
    case 'staff':
      return '/admin/staff';
    case 'registration':
    case 'approval':
    case 'suspension':
    case 'subscription':
      return '/admin/profile';
    default: {
      if (titleLower.includes('pos') || msgLower.includes('pos order')) return '/admin/pos';
      if (titleLower.includes('inventory') || titleLower.includes('stock')) return '/admin/inventory';
      if (titleLower.includes('housekeeping') || titleLower.includes('laundry') || titleLower.includes('clean')) return '/admin/housekeeping';
      if (titleLower.includes('room')) return '/admin/rooms';
      if (titleLower.includes('service') || titleLower.includes('water bottle')) return '/admin/frontDesk/services';
      if (notif.linkPath && notif.linkPath.startsWith('/admin')) {
        if (notif.linkPath === '/admin/frontDesk') return '/admin/frontDesk/inhouse';
        if (notif.linkPath === '/admin/reservations') return '/admin/frontDesk/reservations';
        if (notif.linkPath === '/admin/check-in') return '/admin/frontDesk/checkin';
        if (notif.linkPath === '/admin/billing') return '/admin/frontDesk/billing';
        return notif.linkPath;
      }
      return '/admin/dashboard';
    }
  }
}

export function filterNotificationsForRoleAndHotel(
  notifications: AppNotification[],
  currentRole: UserRole,
  selectedHotelId: string
): AppNotification[] {
  return notifications.filter((n) => {
    if (!n) return false;
    if (currentRole === 'SuperAdmin') {
      return n.hotelId === 'SUPERADMIN' || n.recipientRole === 'SuperAdmin';
    }
    // Strict Hotel-level tenant isolation: must match selectedHotelId
    if (n.hotelId !== selectedHotelId) return false;
    if (n.recipientRole === 'SuperAdmin') return false;
    if (currentRole === 'Owner') {
      return n.recipientRole === 'Owner' || n.recipientRole === 'All';
    }
    return n.recipientRole === 'Admin' || n.recipientRole === 'All';
  });
}

export default function NotificationBellAndDrawer({
  notifications = [],
  currentRole,
  selectedHotelId,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateLink,
  onOpenNotification,
  isLoading = false,
  error = null,
  isRealtimeConnected = false,
  onRefresh
}: NotificationBellAndDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const drawerRef = useRef<HTMLDivElement>(null);

  const visibleNotifications = filterNotificationsForRoleAndHotel(
    notifications,
    currentRole,
    selectedHotelId
  );

  const unreadCount = visibleNotifications.filter((n) => !n.isRead).length;
  const displayedNotifications =
    filterMode === 'unread'
      ? visibleNotifications.filter((n) => !n.isRead)
      : visibleNotifications;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getTypeIcon = (type: AppNotification['type'], severity: AppNotification['severity']) => {
    const baseClass =
      severity === 'success'
        ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
        : severity === 'warning'
        ? 'text-amber-600 bg-amber-50 border-amber-200'
        : severity === 'error'
        ? 'text-rose-600 bg-rose-50 border-rose-200'
        : 'text-luxury-gold-600 bg-luxury-beige-50 border-luxury-gold-500/30';

    switch (type) {
      case 'registration':
      case 'approval':
      case 'suspension':
        return (
          <div className={`p-2 rounded-xl border shrink-0 ${baseClass}`}>
            <Building2 className="w-4 h-4" />
          </div>
        );
      case 'booking':
      case 'checkin':
      case 'checkout':
        return (
          <div className={`p-2 rounded-xl border shrink-0 ${baseClass}`}>
            <Calendar className="w-4 h-4" />
          </div>
        );
      case 'payment':
      case 'subscription':
        return (
          <div className={`p-2 rounded-xl border shrink-0 ${baseClass}`}>
            <CreditCard className="w-4 h-4" />
          </div>
        );
      case 'expense':
        return (
          <div className={`p-2 rounded-xl border shrink-0 ${baseClass}`}>
            <Wallet className="w-4 h-4" />
          </div>
        );
      case 'invoice':
        return (
          <div className={`p-2 rounded-xl border shrink-0 ${baseClass}`}>
            <FileText className="w-4 h-4" />
          </div>
        );
      case 'staff':
        return (
          <div className={`p-2 rounded-xl border shrink-0 ${baseClass}`}>
            <UserCheck className="w-4 h-4" />
          </div>
        );
      case 'security':
        return (
          <div className={`p-2 rounded-xl border shrink-0 ${baseClass}`}>
            <ShieldCheck className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className={`p-2 rounded-xl border shrink-0 ${baseClass}`}>
            <Sparkles className="w-4 h-4" />
          </div>
        );
    }
  };

  const formatRelativeTime = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return isoDate;
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoDate;
    }
  };

  const fullCenterPath =
    currentRole === 'SuperAdmin'
      ? '/superadmin/notifications'
      : currentRole === 'Owner'
      ? '/hotelowner/notifications'
      : '/admin/notifications';

  return (
    <div className="relative" ref={drawerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className="relative p-2 rounded-xl bg-luxury-beige-50 hover:bg-luxury-gold-500/15 border border-luxury-brown-200 hover:border-luxury-gold-500 text-luxury-brown-900 transition-all cursor-pointer"
      >
        <Bell className="w-4 h-4 text-luxury-brown-800" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold flex items-center justify-center shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed md:absolute right-4 md:right-0 top-16 md:top-12 w-[calc(100vw-2rem)] sm:w-96 bg-white border border-luxury-brown-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="bg-luxury-brown-950 text-white px-4 py-3.5 flex items-center justify-between border-b border-luxury-gold-500/20">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-luxury-gold-400" />
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-serif font-bold tracking-wide text-luxury-beige-50">
                    Notification Center
                  </h4>
                  <span
                    title={isRealtimeConnected ? 'Live SSE Stream Connected' : 'Synced via Cloud API'}
                    className={`w-1.5 h-1.5 rounded-full ${
                      isRealtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-luxury-gold-400'
                    }`}
                  />
                </div>
                <p className="text-[10px] font-mono text-luxury-gold-300">
                  {currentRole === 'SuperAdmin'
                    ? 'SaaS Platform Alerts'
                    : `${currentRole} Property Alerts`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  title="Refresh Notifications"
                  className="p-1 text-luxury-gold-300 hover:text-white rounded-lg cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  className="px-2.5 py-1 rounded-lg bg-luxury-gold-500/20 hover:bg-luxury-gold-500/30 border border-luxury-gold-500/30 text-luxury-gold-300 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-luxury-brown-300 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-luxury-beige-50 px-4 py-2 border-b border-luxury-brown-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold cursor-pointer transition-colors ${
                  filterMode === 'all'
                    ? 'bg-luxury-brown-900 text-luxury-gold-300'
                    : 'text-luxury-brown-600 hover:bg-luxury-brown-100'
                }`}
              >
                All ({visibleNotifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('unread')}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold cursor-pointer transition-colors ${
                  filterMode === 'unread'
                    ? 'bg-luxury-brown-900 text-luxury-gold-300'
                    : 'text-luxury-brown-600 hover:bg-luxury-brown-100'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
            <span className="text-[10px] font-mono text-luxury-brown-500">
              {isRealtimeConnected ? 'Live Stream' : 'Tenant Scoped'}
            </span>
          </div>

          {/* Notification Items List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-luxury-brown-100">
            {error ? (
              <div className="p-6 text-center space-y-2 bg-rose-50/60">
                <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
                <p className="text-xs font-serif font-bold text-rose-900">
                  Unable to sync notifications
                </p>
                <p className="text-[11px] text-rose-700">{error}</p>
                {onRefresh && (
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-mono font-bold cursor-pointer"
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : isLoading && displayedNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-luxury-gold-600 animate-spin mx-auto" />
                <p className="text-xs font-serif font-bold text-luxury-brown-800">
                  Loading notifications...
                </p>
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Bell className="w-7 h-7 text-luxury-brown-300 mx-auto" />
                <p className="text-xs font-serif font-bold text-luxury-brown-800">
                  {filterMode === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-luxury-brown-500">
                  Real-time booking, check-in, invoice, and approval alerts will appear here.
                </p>
              </div>
            ) : (
              displayedNotifications.slice(0, 25).map((item) => {
                const targetLink = resolveNotificationActionLink(item, currentRole);
                const handleOpenInNotificationCenter = () => {
                  if (!item.isRead) onMarkAsRead(item.id);
                  setIsOpen(false);
                  if (onOpenNotification) {
                    onOpenNotification(item);
                  } else if (onNavigateLink) {
                    onNavigateLink(fullCenterPath);
                  }
                };
                return (
                  <div
                    key={item.id}
                    onClick={handleOpenInNotificationCenter}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                      item.isRead
                        ? 'bg-white hover:bg-luxury-beige-50/50'
                        : 'bg-luxury-gold-500/5 hover:bg-luxury-gold-500/10'
                    }`}
                  >
                    {getTypeIcon(item.type, item.severity)}

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-xs leading-snug ${
                            item.isRead
                              ? 'font-medium text-luxury-brown-800'
                              : 'font-bold text-luxury-brown-950'
                          }`}
                        >
                          {item.title}
                        </p>
                        {!item.isRead && (
                          <span className="w-2 h-2 rounded-full bg-luxury-gold-500 shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="text-[11px] text-luxury-brown-600 leading-relaxed line-clamp-2">
                        {item.message}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-luxury-brown-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(item.createdAt)}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInNotificationCenter();
                            }}
                            className="text-luxury-gold-700 hover:text-luxury-brown-950 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                          >
                            Open <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                          {!item.isRead && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkAsRead(item.id);
                              }}
                              className="text-emerald-700 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                            >
                              <Check className="w-3 h-3" /> Read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Link to Full Notification Center */}
          <div className="bg-luxury-beige-50 px-4 py-2.5 border-t border-luxury-brown-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (onNavigateLink) {
                  onNavigateLink(fullCenterPath);
                  setIsOpen(false);
                }
              }}
              className="w-full text-center text-[11px] font-mono font-bold text-luxury-brown-900 hover:text-luxury-gold-700 transition-colors cursor-pointer"
            >
              View Full Notification Center →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

