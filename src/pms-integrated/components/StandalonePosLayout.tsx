import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Utensils,
  ShoppingBag,
  LayoutGrid,
  ClipboardList,
  History,
  CalendarRange,
  HelpCircle,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Plus,
  Calendar,
  Maximize2,
  Minimize2,
  ArrowLeft,
  LogOut,
  Building2,
  Menu,
  X,
  Pin,
} from 'lucide-react';
import type { Hotel, PosItem, PosOrder, UserRole } from '../../types';
import {
  PosResolvedCapabilities,
  StandalonePosSidebarNode,
  getVisiblePosSidebarTree,
  mapPosSubTabToPath,
} from '../../utils/posConfigHelpers';
import { formatDashboardHeaderDate } from '../../utils/dashboardMetrics';

interface StandalonePosLayoutProps {
  activeSubTab: string;
  onSelectSubTab: (subTab: string) => void;
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectHotel: (hotelId: string) => void;
  hotelName: string;
  posCapabilities: PosResolvedCapabilities;
  posItems?: PosItem[];
  posOrders?: PosOrder[];
  loggedInUser: string;
  currentRole: UserRole;
  onBackToPms: () => void;
  onLogout: () => void;
  notificationBellNode?: React.ReactNode;
  children: React.ReactNode;
}

function renderPosNavIcon(id: string, active: boolean): React.ReactNode {
  const cls = `w-4 h-4 shrink-0 transition-colors ${
    active ? 'text-[#17120F]' : 'text-[#C49A3A]/85 group-hover:text-[#F5D88A]'
  }`;
  switch (id) {
    case 'take_order':
      return <ShoppingBag className={cls} />;
    case 'pos':
      return <LayoutGrid className={cls} />;
    case 'orders':
      return <ClipboardList className={cls} />;
    case 'orders_current':
      return <Utensils className={cls} />;
    case 'orders_history':
      return <History className={cls} />;
    case 'reservations':
      return <CalendarRange className={cls} />;
    case 'help':
      return <HelpCircle className={cls} />;
    case 'settings':
      return <Settings className={cls} />;
    default:
      return <Utensils className={cls} />;
  }
}

export const StandalonePosLayout: React.FC<StandalonePosLayoutProps> = ({
  activeSubTab,
  onSelectSubTab,
  hotels,
  selectedHotelId,
  onSelectHotel,
  hotelName,
  posCapabilities,
  posItems = [],
  posOrders = [],
  loggedInUser,
  currentRole,
  onBackToPms,
  onLogout,
  notificationBellNode,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ordersExpanded, setOrdersExpanded] = useState(true);
  const [outletDropdownOpen, setOutletDropdownOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedPosDate, setSelectedPosDate] = useState<string>(todayIso);

  const profileRef = useRef<HTMLDivElement | null>(null);
  const outletRef = useRef<HTMLDivElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const visibleSidebarTree = useMemo(
    () => getVisiblePosSidebarTree(posCapabilities),
    [posCapabilities]
  );

  // Sync fullscreen state
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (profileRef.current && t && !profileRef.current.contains(t)) {
        setProfileMenuOpen(false);
      }
      if (outletRef.current && t && !outletRef.current.contains(t)) {
        setOutletDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const currentOrdersCount = useMemo(
    () =>
      posOrders.filter((o) => {
        const st = String(o.status || '').toLowerCase();
        const kotSt = String((o as any).kotStatus || '').toLowerCase();
        if (st === 'cancelled' || kotSt === 'cancelled') return false;
        const payDetail = String((o as any).paymentStatusDetail || o.paymentStatus || '');
        const isDone =
          (kotSt === 'served' || st === 'settled') &&
          (payDetail === 'Paid' || payDetail === 'Unpaid (Room Folio)');
        return !isDone;
      }).length,
    [posOrders]
  );

  const userInitials = useMemo(() => {
    const src = (loggedInUser || currentRole || 'DS').trim();
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }, [loggedInUser, currentRole]);

  const navigatePosTab = (subTab: string, resetOrderTicket = false) => {
    setMobileMenuOpen(false);
    onSelectSubTab(subTab);
    if (typeof window !== 'undefined') {
      const targetPath = mapPosSubTabToPath(subTab);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
      if (resetOrderTicket) {
        window.dispatchEvent(new CustomEvent('directstay:pos-new-order'));
      }
    }
  };

  const handleToggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleSearchChange = (val: string) => {
    setHeaderSearch(val);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('directstay:pos-global-search', { detail: { query: val } })
      );
    }
  };

  const handleDateChange = (nextDate: string) => {
    if (!nextDate) return;
    setSelectedPosDate(nextDate);
    if (typeof window !== 'undefined') {
      (window as any).__directstayPosOperationalDate = nextDate;
      window.dispatchEvent(
        new CustomEvent('directstay:pos-date-filter', { detail: { date: nextDate } })
      );
    }
  };

  const quickSearchMatches = useMemo(() => {
    const q = headerSearch.trim().toLowerCase();
    if (!q) return { items: [] as PosItem[], orders: [] as PosOrder[] };
    const items = posItems
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          String(m.category || '').toLowerCase().includes(q)
      )
      .slice(0, 5);
    const orders = posOrders
      .filter(
        (o) =>
          String(o.orderNumber || '').toLowerCase().includes(q) ||
          String(o.guestName || '').toLowerCase().includes(q) ||
          String(o.roomNumber || o.tableNo || '').toLowerCase().includes(q)
      )
      .slice(0, 5);
    return { items, orders };
  }, [headerSearch, posItems, posOrders]);

  const isLeafActive = (node: StandalonePosSidebarNode): boolean => {
    if (node.id === 'take_order') return activeSubTab === 'take_order';
    if (node.id === 'pos') {
      return ['terminal', 'dashboard', 'kds', 'tables', 'catalog', 'qr_menu', 'reports'].includes(
        activeSubTab
      );
    }
    if (node.id === 'orders_current') return activeSubTab === 'orders_current' || activeSubTab === 'orders';
    if (node.id === 'orders_history') return activeSubTab === 'orders_history';
    if (node.id === 'reservations') return activeSubTab === 'advance_booking';
    if (node.id === 'help') return activeSubTab === 'help';
    if (node.id === 'settings') return activeSubTab === 'settings';
    return false;
  };

  const renderSidebarNodes = (isMobile = false) =>
    visibleSidebarTree.map((node) => {
      if (node.children && node.children.length > 0) {
        const anyChildActive = node.children.some((c) => isLeafActive(c));
        return (
          <div key={node.id} className="space-y-0.5">
            <button
              type="button"
              onClick={() => {
                if (isCollapsed && !isMobile) {
                  setIsCollapsed(false);
                  setOrdersExpanded(true);
                } else {
                  setOrdersExpanded((prev) => !prev);
                }
              }}
              className={`group w-full flex items-center ${
                isCollapsed && !isMobile ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
              } rounded-xl text-[13px] transition cursor-pointer ${
                anyChildActive
                  ? 'bg-[#261D16] text-[#F5D88A] font-semibold'
                  : 'text-[#D8CBB8] hover:bg-[#221A14] hover:text-[#FBF4E0] font-medium'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                {renderPosNavIcon(node.id, false)}
                {(!isCollapsed || isMobile) && <span className="truncate">{node.label}</span>}
              </span>
              {(!isCollapsed || isMobile) &&
                (ordersExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#A89376] shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#A89376] shrink-0" />
                ))}
            </button>

            {(!isCollapsed || isMobile) && ordersExpanded && (
              <div className="ml-3 pl-2.5 border-l border-[#2F241B] space-y-0.5">
                {node.children.map((child) => {
                  const active = isLeafActive(child);
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => child.subTab && navigatePosTab(child.subTab)}
                      className={`group w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] transition cursor-pointer ${
                        active
                          ? 'bg-gradient-to-r from-[#DFB962] via-[#CEA346] to-[#BE9032] text-[#17120F] font-bold shadow-xs'
                          : 'text-[#D8CBB8] hover:bg-[#221A14] hover:text-[#FBF4E0] font-medium'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {renderPosNavIcon(child.id, active)}
                        <span className="truncate">{child.label}</span>
                      </span>
                      {child.id === 'orders_current' && currentOrdersCount > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            active
                              ? 'bg-[#17120F]/15 text-[#17120F]'
                              : 'bg-[#C49A3A]/20 text-[#F5D88A]'
                          }`}
                        >
                          {currentOrdersCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      const active = isLeafActive(node);
      return (
        <button
          key={node.id}
          type="button"
          onClick={() =>
            node.subTab && navigatePosTab(node.subTab, node.id === 'take_order')
          }
          title={isCollapsed && !isMobile ? node.label : undefined}
          className={`group w-full flex items-center ${
            isCollapsed && !isMobile ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
          } rounded-xl text-[13px] transition cursor-pointer ${
            active
              ? 'bg-gradient-to-r from-[#DFB962] via-[#CEA346] to-[#BE9032] text-[#17120F] font-bold shadow-xs'
              : 'text-[#D8CBB8] hover:bg-[#221A14] hover:text-[#FBF4E0] font-medium'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            {renderPosNavIcon(node.id, active)}
            {(!isCollapsed || isMobile) && <span className="truncate">{node.label}</span>}
          </span>
          {(!isCollapsed || isMobile) && active && (
            <Pin className="w-3.5 h-3.5 text-[#17120F]/80 shrink-0 rotate-45" />
          )}
        </button>
      );
    });

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-[#FAF7F0] flex flex-col md:flex-row text-[#17120F] font-sans">
      {/* ==================================================================== */}
      {/* STANDALONE POS DESKTOP SIDEBAR                                       */}
      {/* ==================================================================== */}
      <aside
        data-testid="directstay-pos-sidebar"
        className={`${
          isCollapsed ? 'w-[72px]' : 'w-[240px]'
        } bg-[#17120F] text-[#E6DCD2] hidden md:flex flex-col justify-between shrink-0 select-none border-r border-[#2B211A] h-screen sticky top-0 transition-all duration-200 z-30 no-print`}
      >
        {/* POS Brand Header */}
        <div className="h-16 px-3.5 border-b border-[#2B211A] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigatePosTab('terminal')}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DFB962] to-[#B08326] text-[#17120F] font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0">
              <Utensils className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="font-serif font-extrabold text-base tracking-tight text-[#FBF4E0] truncate leading-none">
                  DirectStay<span className="text-[#DFB962]">.</span>{' '}
                  <span className="text-[10px] font-sans uppercase tracking-widest text-[#DFB962]">
                    POS
                  </span>
                </div>
                <div className="text-[10px] text-[#9E886B] truncate mt-0.5">
                  {posCapabilities.inHouseRestaurantAvailable
                    ? 'Restaurant & Room Service'
                    : 'Room Service Only'}
                </div>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="p-1.5 rounded-lg text-[#A89376] hover:text-[#FBF4E0] hover:bg-[#241C16] transition cursor-pointer shrink-0"
            title={isCollapsed ? 'Expand POS sidebar' : 'Collapse POS sidebar'}
          >
            {isCollapsed ? (
              <ChevronsRight className="w-4 h-4" />
            ) : (
              <ChevronsLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* POS Navigation Links */}
        <nav
          aria-label="DirectStay POS Navigation"
          className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1"
        >
          {renderSidebarNodes(false)}
        </nav>

        {/* Quick Back to PMS Footer */}
        <div className="p-2.5 border-t border-[#2B211A] space-y-2 shrink-0">
          <button
            type="button"
            onClick={onBackToPms}
            title="Back to PMS"
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center p-2' : 'justify-center gap-2 px-3 py-2'
            } rounded-xl bg-[#241C16] hover:bg-[#2F241C] text-[#F5D88A] border border-[#C49A3A]/35 text-xs font-bold transition cursor-pointer`}
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span>Back to PMS</span>}
          </button>
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* MOBILE DRAWER                                                        */}
      {/* ==================================================================== */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex no-print">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-[272px] max-w-[85vw] bg-[#17120F] text-[#E6DCD2] h-full flex flex-col justify-between border-r border-[#2B211A] shadow-2xl z-10">
            <div className="h-14 px-4 border-b border-[#2B211A] flex items-center justify-between">
              <div className="font-serif font-extrabold text-base text-[#FBF4E0]">
                DirectStay<span className="text-[#DFB962]">.</span>{' '}
                <span className="text-[10px] font-sans uppercase tracking-widest text-[#DFB962]">
                  POS
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-[#A89376] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {renderSidebarNodes(true)}
            </nav>

            <div className="p-3 border-t border-[#2B211A] space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onBackToPms();
                }}
                className="w-full py-2 px-3 rounded-xl bg-[#241C16] text-[#F5D88A] border border-[#C49A3A]/40 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to PMS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* POS MAIN WORKSPACE + DEDICATED POS TOP HEADER                        */}
      {/* ==================================================================== */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-[#E8DEC8] px-3.5 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0 no-print shadow-2xs">
          {/* Left: Mobile Hamburger + Property/Outlet Selector + Global Search */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-[#17120F] text-[#F5D88A] shrink-0"
              aria-label="Open POS Menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Property / Outlet Selector */}
            <div ref={outletRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setOutletDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF7F0] hover:bg-[#F3ECE0] border border-[#E2D6BE] text-left transition cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-[#B08326] shrink-0" />
                <div className="hidden sm:block max-w-[180px]">
                  <div className="text-xs font-extrabold text-[#17120F] truncate leading-tight">
                    {hotelName}
                  </div>
                  <div className="text-[10px] text-[#8C7355] font-semibold truncate leading-tight">
                    {posCapabilities.posOutletName}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#8C7355] shrink-0" />
              </button>

              {outletDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 rounded-2xl bg-white border border-[#E2D6BE] shadow-xl z-40 py-2 text-xs">
                  <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#8C7355]">
                    Property &amp; Outlet
                  </div>
                  {hotels.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        onSelectHotel(h.id);
                        setOutletDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#FAF6EE] cursor-pointer ${
                        h.id === selectedHotelId ? 'font-bold text-[#17120F]' : 'text-slate-600'
                      }`}
                    >
                      <span className="truncate">{h.name}</span>
                      {h.id === selectedHotelId && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                          Active
                        </span>
                      )}
                    </button>
                  ))}
                  <div className="mt-1 pt-1.5 border-t border-slate-100 px-3">
                    <button
                      type="button"
                      onClick={() => {
                        setOutletDropdownOpen(false);
                        navigatePosTab('settings');
                      }}
                      className="w-full py-1.5 text-left text-[11px] font-bold text-[#B08326] hover:underline cursor-pointer"
                    >
                      Configure Kitchen &amp; Outlet Settings →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* POS Search Input */}
            <div className="relative flex-1 max-w-md min-w-[140px]">
              <Search className="w-3.5 h-3.5 text-[#9E886B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={headerSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search dishes, orders, room/table..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#FAF7F0] border border-[#E5DAC3] text-xs text-[#17120F] placeholder:text-[#9E886B] focus:outline-none focus:border-[#C49A3A] focus:bg-white"
              />

              {searchFocused && headerSearch.trim().length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 rounded-2xl bg-white border border-[#E2D6BE] shadow-xl z-40 max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {quickSearchMatches.items.length === 0 &&
                  quickSearchMatches.orders.length === 0 ? (
                    <div className="px-3 py-4 text-center text-slate-400">
                      No matching menu items or POS orders
                    </div>
                  ) : (
                    <>
                      {quickSearchMatches.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={() => {
                            navigatePosTab('take_order');
                            handleSearchChange(item.name);
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-[#FAF6EE] flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-bold text-[#17120F] truncate">{item.name}</span>
                          <span className="text-[11px] font-bold text-[#8C7355]">
                            ₹{item.price}
                          </span>
                        </button>
                      ))}
                      {quickSearchMatches.orders.map((ord) => (
                        <button
                          key={ord.id}
                          type="button"
                          onMouseDown={() => {
                            navigatePosTab('orders_current');
                            setHeaderSearch('');
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-[#FAF6EE] flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate">
                            <strong className="text-[#17120F]">{ord.orderNumber}</strong> •{' '}
                            {ord.guestName || ord.roomNumber || ord.tableNo || ord.orderType}
                          </span>
                          <span className="text-[10px] font-bold text-amber-800">
                            ₹{ord.grandTotal}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: + New Order • Date • Notifications • Fullscreen • User Profile */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigatePosTab('take_order', true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#1E1610] to-[#2C2017] hover:from-black hover:to-[#1E1610] text-[#F5D88A] border border-[#C49A3A]/50 font-bold text-xs shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#DFB962] stroke-[2.5]" />
              <span>New Order</span>
            </button>

            {/* Date Selector */}
            <div className="hidden lg:flex items-center gap-1.5 bg-[#FAF7F0] border border-[#E2D6BE] rounded-xl px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#B08326]" />
              <button
                type="button"
                onClick={() => {
                  if (dateInputRef.current?.showPicker) dateInputRef.current.showPicker();
                  else dateInputRef.current?.focus();
                }}
                className="text-xs font-semibold text-[#17120F] flex items-center gap-1 cursor-pointer"
              >
                <span>{formatDashboardHeaderDate(selectedPosDate, todayIso)}</span>
                <ChevronDown className="w-3 h-3 text-[#8C7355]" />
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={selectedPosDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="sr-only"
                aria-label="POS Operational Date"
              />
            </div>

            {/* Notifications Bell */}
            {notificationBellNode}

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              className="p-2 rounded-xl bg-[#FAF7F0] hover:bg-[#F3ECE0] border border-[#E2D6BE] text-[#17120F] transition cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-[#8C7355]" />
              ) : (
                <Maximize2 className="w-4 h-4 text-[#8C7355]" />
              )}
            </button>

            {/* User Profile Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-[#FAF7F0] hover:bg-[#F3ECE0] border border-[#E2D6BE] transition cursor-pointer"
              >
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#DFB962] to-[#A67C27] text-[#17120F] font-extrabold text-[11px] flex items-center justify-center">
                  {userInitials}
                </span>
                <span className="hidden sm:block text-xs font-bold text-[#17120F] max-w-[100px] truncate">
                  {loggedInUser || currentRole}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#8C7355]" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-white border border-[#E2D6BE] shadow-xl z-50 py-1.5 text-xs">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <div className="font-extrabold text-[#17120F] truncate">
                      {loggedInUser || currentRole}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#B08326]">
                      {currentRole} • DirectStay POS
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigatePosTab('settings');
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-[#FAF6EE] flex items-center gap-2.5 text-slate-700 font-semibold cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#B08326]" />
                    <span>Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigatePosTab('help');
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-[#FAF6EE] flex items-center gap-2.5 text-slate-700 font-semibold cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-[#B08326]" />
                    <span>Help</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onBackToPms();
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-[#FAF6EE] flex items-center gap-2.5 text-[#17120F] font-bold cursor-pointer border-t border-slate-100 mt-1 pt-2"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-[#B08326]" />
                    <span>Back to PMS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-rose-50 flex items-center gap-2.5 text-rose-600 font-bold cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* POS Content Area */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 overflow-y-auto overflow-x-hidden min-w-0">
          <div className="max-w-[1600px] mx-auto min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
};
