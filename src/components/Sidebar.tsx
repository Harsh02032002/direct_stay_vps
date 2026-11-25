import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Monitor,
  Sparkles,
  ConciergeBell,
  BarChart3,
  Globe,
  Share2,
  Building2,
  Settings,
  ShieldCheck,
  CalendarRange,
  CalendarPlus,
  TrendingUp,
  Users,
  CalendarHeart,
  UserCheck,
  Smartphone,
  Receipt,
  Search,
  LayoutGrid,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Pin,
  LogOut,
  Menu,
  X,
  Star,
  Crown,
  Package,
  Key,
  Briefcase,
  FileText,
  DollarSign,
  PieChart,
  Bell,
  Wallet,
  Utensils,
} from 'lucide-react';
import { openStandalonePosInNewTab } from '../utils/posConfigHelpers';
import { UserRole, Hotel, Staff, RolePermission } from '../types';
import { deriveAllowedSidebarTabsFromRolePerm } from './hrm/RolePermissionsView';
import type { HotelOwnerSubTab } from './HotelOwnerView';
import {
  useRbacMatrix,
  getAllowedSidebarTabsForRole,
  normalizeRbacRole,
} from '../pms-integrated/utils/rbacPermissions';
import {
  DIRECTSTAY_PMS_SIDEBAR_TREE,
  SidebarMenuNode,
  SidebarNavTarget,
  filterSidebarTreeByAllowedTabs,
  isSidebarBranchActive,
  isSidebarLeafActive,
} from '../utils/sidebarNavigation';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  superAdminSubTab?: 'dashboard' | 'hotels' | 'packages' | 'users' | 'leads' | 'website' | 'blogs' | 'pages';
  onSelectSuperAdminSubTab?: (tab: 'dashboard' | 'hotels' | 'packages' | 'users' | 'leads' | 'website' | 'blogs' | 'pages') => void;
  ownerSubTab?: HotelOwnerSubTab;
  onSelectOwnerSubTab?: (tab: HotelOwnerSubTab) => void;
  financeSubTab?: string;
  onSelectFinanceSubTab?: (tab: string) => void;
  frontDeskSubTab?: string;
  onSelectFrontDeskSubTab?: (tab: string) => void;
  roomSubTab?: string;
  onSelectRoomSubTab?: (tab: string) => void;
  housekeepingSubTab?: string;
  onSelectHousekeepingSubTab?: (tab: string) => void;
  posSubTab?: string;
  onSelectPosSubTab?: (tab: string) => void;
  inventorySubTab?: string;
  onSelectInventorySubTab?: (tab: string) => void;
  otaSubTab?: string;
  onSelectOtaSubTab?: (tab: string) => void;
  reportsSubTab?: string;
  onSelectReportsSubTab?: (tab: string) => void;
  staffSubTab?: string;
  onSelectStaffSubTab?: (tab: string) => void;
  invoiceSubTab?: string;
  onSelectInvoiceSubTab?: (tab: string) => void;
  profileSection?: string;
  onSelectProfileSection?: (section: string) => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectHotel: (hotelId: string) => void;
  onLogout: () => void;
  isSuperAdminUser: boolean;
  loggedInUser: string;
  unreadNotificationsCount?: number;
  onOpenPublicWebsite?: () => void;
  staff?: Staff[];
  rolePermissions?: RolePermission[];
}

function renderSidebarIcon(iconKey: string, isActive: boolean): React.ReactNode {
  const cls = `w-4 h-4 shrink-0 transition-colors ${
    isActive ? 'text-[#17120F]' : 'text-[#C49A3A]/85 group-hover:text-[#F5D88A]'
  }`;
  switch (iconKey) {
    case 'dashboard':
      return <LayoutDashboard className={cls} />;
    case 'stayOverview':
      return <Monitor className={cls} />;
    case 'housekeeping':
      return <Sparkles className={cls} />;
    case 'frontOffice':
      return <ConciergeBell className={cls} />;
    case 'reservationList':
      return <CalendarRange className={cls} />;
    case 'newReservation':
      return <CalendarPlus className={cls} />;
    case 'inventory':
    case 'ratesInventory':
      return <Package className={cls} />;
    case 'groupBookings':
      return <Users className={cls} />;
    case 'eventBookings':
      return <CalendarHeart className={cls} />;
    case 'guestProfiles':
      return <UserCheck className={cls} />;
    case 'guestSelfService':
      return <Smartphone className={cls} />;
    case 'invoicesBilling':
      return <Receipt className={cls} />;
    case 'guestServices':
      return <Sparkles className={cls} />;
    case 'lostFound':
      return <Search className={cls} />;
    case 'availability':
      return <LayoutGrid className={cls} />;
    case 'guestStatus':
      return <Users className={cls} />;
    case 'reportsGraphs':
      return <BarChart3 className={cls} />;
    case 'bookingEngine':
      return <Globe className={cls} />;
    case 'channelManager':
      return <Share2 className={cls} />;
    case 'financialHub':
      return <Wallet className={cls} />;
    case 'hrmModule':
      return <Briefcase className={cls} />;
    case 'pointOfSale':
      return <Utensils className={cls} />;
    case 'propertySetup':
      return <Building2 className={cls} />;
    case 'configuration':
      return <Settings className={cls} />;
    case 'administration':
      return <ShieldCheck className={cls} />;
    case 'none':
      return null;
    default:
      return (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
            isActive ? 'bg-[#17120F]' : 'bg-[#9E886B] group-hover:bg-[#F5D88A]'
          }`}
        />
      );
  }
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  superAdminSubTab = 'dashboard',
  onSelectSuperAdminSubTab,
  ownerSubTab = 'dashboard',
  onSelectOwnerSubTab,
  frontDeskSubTab = 'reservations',
  onSelectFrontDeskSubTab,
  roomSubTab = 'dashboard',
  onSelectRoomSubTab,
  housekeepingSubTab = 'dashboard',
  onSelectHousekeepingSubTab,
  otaSubTab = 'channels',
  onSelectOtaSubTab,
  reportsSubTab = 'daily_sales',
  onSelectReportsSubTab,
  financeSubTab = 'dashboard',
  onSelectFinanceSubTab,
  staffSubTab = 'directory',
  onSelectStaffSubTab,
  invoiceSubTab = 'all',
  onSelectInvoiceSubTab,
  inventorySubTab = 'products',
  onSelectInventorySubTab,
  profileSection = 'tax',
  onSelectProfileSection,
  currentRole,
  hotels,
  selectedHotelId,
  onSelectHotel,
  onLogout,
  loggedInUser,
  unreadNotificationsCount = 0,
  staff = [],
  rolePermissions = [],
}: SidebarProps) {
  const [rbacMatrix] = useRbacMatrix();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [hotelPickerOpen, setHotelPickerOpen] = useState(false);
  const [lastSelectedSidebarId, setLastSelectedSidebarId] = useState<string | null>(null);

  // Track expanded collapsible branches (top-level & nested inside Front Office)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    'front-office': true,
    'fo-availability': false,
    'fo-guest-status': false,
    'financial-hub': false,
    'fin-vouchers': false,
    'hrm-module': false,
    'property-setup': false,
    configuration: false,
    administration: false,
  });

  const matchedLoggedInStaff = useMemo(
    () => {
      const storedStaffUser =
        typeof window !== 'undefined'
          ? String(sessionStorage.getItem('pms_staff_username') || '').trim().toLowerCase()
          : '';
      return staff.find(
        (s) =>
          (storedStaffUser && s.username && s.username.toLowerCase() === storedStaffUser) ||
          (s.username && s.username.toLowerCase() === (loggedInUser || '').toLowerCase()) ||
          (s.name && s.name.toLowerCase() === (loggedInUser || '').toLowerCase())
      );
    },
    [staff, loggedInUser]
  );

  const effectiveRoleForRbac = matchedLoggedInStaff?.role || currentRole;
  const staffUserKey = matchedLoggedInStaff?.username || null;

  const allowedTabsSet = useMemo(() => {
    const roleLower = String(effectiveRoleForRbac || '').trim().toLowerCase();
    // Admin, Owner, SuperAdmin retain full access
    if (
      !roleLower ||
      roleLower === 'admin' ||
      roleLower === 'owner' ||
      roleLower === 'superadmin' ||
      roleLower === 'hoteladmin'
    ) {
      return null;
    }
    const matchedRolePerm = rolePermissions.find(
      (rp) => String(rp.roleName || '').trim().toLowerCase() === roleLower
    );
    const tabsFromRolePerm = matchedRolePerm
      ? deriveAllowedSidebarTabsFromRolePerm(matchedRolePerm)
      : [];
    const tabsFromStaff =
      Array.isArray(matchedLoggedInStaff?.allowedModules) && matchedLoggedInStaff.allowedModules.length > 0
        ? matchedLoggedInStaff.allowedModules
        : [];
    const tabsFromMatrix = normalizeRbacRole(effectiveRoleForRbac)
      ? getAllowedSidebarTabsForRole(rbacMatrix, effectiveRoleForRbac, staffUserKey)
      : [];

    // Prefer explicit HRM RolePermission matrix when configured; intersect/union cleanly with staff overrides
    if (tabsFromRolePerm.length > 0) {
      const combined = new Set<string>(tabsFromRolePerm);
      if (tabsFromStaff.length > 0) {
        tabsFromStaff.forEach((t) => combined.add(t));
      }
      return combined;
    }
    if (tabsFromStaff.length > 0) {
      return new Set<string>(tabsFromStaff);
    }
    if (tabsFromMatrix.length > 0) {
      return new Set<string>(tabsFromMatrix);
    }
    return new Set<string>(['dashboard']);
  }, [rbacMatrix, rolePermissions, effectiveRoleForRbac, staffUserKey, matchedLoggedInStaff]);

  const canAccessRbacTab = (rbacTab: string): boolean => {
    if (!allowedTabsSet) return true;
    return allowedTabsSet.has(rbacTab);
  };

  const visiblePmsTree = useMemo(
    () => filterSidebarTreeByAllowedTabs(DIRECTSTAY_PMS_SIDEBAR_TREE, canAccessRbacTab),
    [allowedTabsSet]
  );

  const navSnapshot = useMemo(
    () => ({
      activeTab,
      frontDeskSubTab,
      roomSubTab,
      housekeepingSubTab,
      otaSubTab,
      reportsSubTab,
      financeSubTab,
      staffSubTab,
      invoiceSubTab,
      inventorySubTab,
      profileSection,
      lastSelectedSidebarId,
    }),
    [
      activeTab,
      frontDeskSubTab,
      roomSubTab,
      housekeepingSubTab,
      otaSubTab,
      reportsSubTab,
      financeSubTab,
      staffSubTab,
      invoiceSubTab,
      inventorySubTab,
      profileSection,
      lastSelectedSidebarId,
    ]
  );

  // Automatically open parent branch when active route changes
  useEffect(() => {
    const nextExpanded: Record<string, boolean> = {};
    for (const topNode of visiblePmsTree) {
      if (topNode.children?.length && isSidebarBranchActive(topNode, navSnapshot)) {
        nextExpanded[topNode.id] = true;
        for (const child of topNode.children) {
          if (child.children?.length && isSidebarBranchActive(child, navSnapshot)) {
            nextExpanded[child.id] = true;
          }
        }
      }
    }
    if (Object.keys(nextExpanded).length > 0) {
      setExpandedIds((prev) => ({ ...prev, ...nextExpanded }));
    }
  }, [activeTab, frontDeskSubTab, roomSubTab, housekeepingSubTab, otaSubTab, reportsSubTab, financeSubTab, staffSubTab, invoiceSubTab, profileSection]);

  const activeHotel = hotels.find((h) => h.id === selectedHotelId) || hotels[0];
  const hotelCitySnippet = useMemo(() => {
    if (!activeHotel?.address) return 'DirectStay Property';
    const parts = activeHotel.address.split(',').map((p) => p.trim()).filter(Boolean);
    return parts[parts.length - 2] || parts[0] || 'DirectStay Property';
  }, [activeHotel]);

  const userInitials = useMemo(() => {
    const src = (loggedInUser || currentRole || 'DS').trim();
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }, [loggedInUser, currentRole]);

  const toggleBranch = (id: string) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setExpandedIds((prev) => ({ ...prev, [id]: true }));
      return;
    }
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const applyNavigationTarget = (nodeId: string, target: SidebarNavTarget) => {
    setLastSelectedSidebarId(nodeId);
    setMobileDrawerOpen(false);

    // Point of Sale always opens the standalone POS interface in a new browser tab
    if (target.openInNewTab) {
      openStandalonePosInNewTab('terminal', selectedHotelId);
      return;
    }

    // Handle preset flags in sessionStorage + CustomEvents so already-mounted views react immediately
    try {
      if (target.openNewReservationModal) {
        sessionStorage.setItem('pms_open_advance_modal', '1');
      } else {
        sessionStorage.removeItem('pms_open_advance_modal');
      }

      if (target.reservationSegment) {
        sessionStorage.setItem('pms_reservation_segment', target.reservationSegment);
      }

      if (target.bookingCategory) {
        sessionStorage.setItem('pms_booking_category', target.bookingCategory);
      }

      if (target.profileSection) {
        sessionStorage.setItem('pms_profile_section', target.profileSection);
      }

      if (typeof window !== 'undefined') {
        if (target.openNewReservationModal || target.reservationSegment) {
          window.dispatchEvent(
            new CustomEvent('directstay:reservation-nav', {
              detail: {
                openModal: Boolean(target.openNewReservationModal),
                segment: target.reservationSegment || 'All',
              },
            })
          );
        }
        if (target.bookingCategory) {
          window.dispatchEvent(
            new CustomEvent('directstay:checkin-nav', {
              detail: { bookingCategory: target.bookingCategory },
            })
          );
        }
        if (target.profileSection) {
          window.dispatchEvent(
            new CustomEvent('directstay:profile-nav', {
              detail: { section: target.profileSection },
            })
          );
        }
      }
    } catch {
      // Ignore storage errors
    }

    if (target.frontDeskSubTab && onSelectFrontDeskSubTab) {
      onSelectFrontDeskSubTab(target.frontDeskSubTab);
    }
    if (target.roomSubTab && onSelectRoomSubTab) {
      onSelectRoomSubTab(target.roomSubTab);
    }
    if (target.housekeepingSubTab && onSelectHousekeepingSubTab) {
      onSelectHousekeepingSubTab(target.housekeepingSubTab);
    }
    if (target.otaSubTab && onSelectOtaSubTab) {
      onSelectOtaSubTab(target.otaSubTab);
    }
    if (target.reportsSubTab && onSelectReportsSubTab) {
      onSelectReportsSubTab(target.reportsSubTab);
    }
    if (target.financeSubTab && onSelectFinanceSubTab) {
      onSelectFinanceSubTab(target.financeSubTab);
    }
    if (target.staffSubTab && onSelectStaffSubTab) {
      onSelectStaffSubTab(target.staffSubTab);
    }
    if (target.invoiceSubTab && onSelectInvoiceSubTab) {
      onSelectInvoiceSubTab(target.invoiceSubTab);
    }
    if (target.inventorySubTab && onSelectInventorySubTab) {
      onSelectInventorySubTab(target.inventorySubTab);
    }
    if (target.profileSection && onSelectProfileSection) {
      onSelectProfileSection(target.profileSection);
    }

    setActiveTab(target.activeTab);
  };

  // ============================================================================
  // 1. SUPERADMIN & HOTEL OWNER SPECIALIZED PORTALS (UNCHANGED CAPABILITIES)
  // ============================================================================
  if (currentRole === 'SuperAdmin' || currentRole === 'Owner') {
    const superAdminItems = [
      { id: 'dashboard', label: 'SaaS Overview', icon: LayoutDashboard },
      { id: 'hotels', label: 'Hotel Properties', icon: Building2 },
      { id: 'packages', label: 'Packages & Plans', icon: Package },
      { id: 'users', label: 'User Credentials', icon: Key },
      { id: 'leads', label: 'Salesperson Leads & CRM', icon: Briefcase },
      { id: 'website', label: 'Website CMS', icon: Globe },
      { id: 'blogs', label: 'SEO Blog Manager', icon: FileText },
      { id: 'pages', label: 'Custom Pages', icon: FileText },
    ] as const;

    const ownerItems: { id: HotelOwnerSubTab; label: string; icon: any }[] = [
      { id: 'dashboard', label: 'Executive Overview', icon: Crown },
      { id: 'property', label: 'Property Details', icon: Building2 },
      { id: 'bookings', label: 'Booking Registry', icon: CalendarRange },
      { id: 'financials', label: 'Revenue & Expenses', icon: DollarSign },
      { id: 'occupancy', label: 'Financial & Occupancy', icon: PieChart },
      { id: 'staff', label: 'Staff Overview', icon: Users },
      { id: 'subscription', label: 'Subscription & Plan', icon: Package },
      { id: 'auditLogs', label: 'Security Audit Logs', icon: ShieldCheck },
    ];

    return (
      <div className="w-64 bg-[#17120F] text-[#E6DCD2] flex flex-col justify-between hidden md:flex shrink-0 select-none border-r border-[#2C221B] h-screen sticky top-0 no-print">
        <div className="p-4 border-b border-[#2C221B] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D8B25C] to-[#A67C27] text-[#17120F] flex items-center justify-center font-extrabold text-sm shadow-sm">
            DS
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#FBF4E0] truncate">DirectStay PMS</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#C49A3A]">
              {currentRole === 'SuperAdmin' ? 'SaaS Super Admin' : 'Owner Executive Hub'}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {currentRole === 'SuperAdmin'
            ? superAdminItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === 'superAdminHub' && superAdminSubTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab('superAdminHub');
                      onSelectSuperAdminSubTab?.(item.id);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-[#D8B25C] to-[#C49A3A] text-[#17120F] font-bold shadow-sm'
                        : 'text-[#D8CBB8] hover:bg-[#231B15] hover:text-[#FBF4E0]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {active && <Pin className="w-3.5 h-3.5 shrink-0 rotate-45" />}
                  </button>
                );
              })
            : ownerItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab !== 'profile' && activeTab !== 'notifications' && ownerSubTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab('hotelOwnerHub');
                      onSelectOwnerSubTab?.(item.id);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-[#D8B25C] to-[#C49A3A] text-[#17120F] font-bold shadow-sm'
                        : 'text-[#D8CBB8] hover:bg-[#231B15] hover:text-[#FBF4E0]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {active && <Pin className="w-3.5 h-3.5 shrink-0 rotate-45" />}
                  </button>
                );
              })}
        </nav>

        <div className="p-3 border-t border-[#2C221B] space-y-2">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/70 text-rose-200 border border-rose-800/40 text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. REDESIGNED DIRECTSTAY PMS SIDEBAR (EXACT RETROD STRUCTURE + DIRECTSTAY THEME)
  // ============================================================================
  const renderMenuNode = (node: SidebarMenuNode, depth = 0): React.ReactNode => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const branchActive = isSidebarBranchActive(node, navSnapshot);
    const leafActive = !hasChildren && isSidebarLeafActive(node, navSnapshot);
    const isExpanded = Boolean(expandedIds[node.id]);

    if (hasChildren) {
      // Nested expandable group (e.g. Availability / Guest Status inside Front Office) vs top-level expandable
      const isNestedGroup = depth > 0;
      return (
        <div key={node.id} className={isNestedGroup ? 'pt-0.5' : ''}>
          <button
            type="button"
            onClick={() => toggleBranch(node.id)}
            title={isCollapsed ? node.label : undefined}
            className={`group w-full flex items-center ${
              isCollapsed ? 'justify-center px-2 py-2.5' : isNestedGroup ? 'justify-between pl-3 pr-2.5 py-2' : 'justify-between px-3 py-2.5'
            } rounded-xl text-[13px] transition-all cursor-pointer ${
              branchActive
                ? 'bg-[#261D16] text-[#F5D88A] font-semibold'
                : 'text-[#D8CBB8] hover:bg-[#221A14] hover:text-[#FBF4E0] font-medium'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              {renderSidebarIcon(node.iconKey, false)}
              {!isCollapsed && <span className="truncate">{node.label}</span>}
            </span>
            {!isCollapsed && (
              isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#A89376] shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#A89376] shrink-0" />
              )
            )}
          </button>

          {!isCollapsed && isExpanded && (
            <div
              className={
                isNestedGroup
                  ? 'ml-4 pl-3 mt-0.5 mb-1 border-l border-[#34281E] space-y-0.5'
                  : 'ml-3 pl-2.5 mt-1 mb-1.5 border-l border-[#2F241B] space-y-0.5'
              }
            >
              {node.children!.map((child) => renderMenuNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Leaf item (Top-level direct item, Front Office child, or nested Availability/Guest Status child)
    const isDeepLeaf = depth >= 2;
    const isSubLeaf = depth === 1;

    return (
      <button
        key={node.id}
        type="button"
        onClick={() => node.target && applyNavigationTarget(node.id, node.target)}
        title={isCollapsed ? node.label : undefined}
        className={`group w-full flex items-center ${
          isCollapsed
            ? 'justify-center px-2 py-2.5'
            : isDeepLeaf
            ? 'justify-between px-2.5 py-1.5 text-[12.5px]'
            : isSubLeaf
            ? 'justify-between px-3 py-2 text-[12.5px]'
            : 'justify-between px-3 py-2.5 text-[13px]'
        } rounded-xl transition-all cursor-pointer ${
          leafActive
            ? 'bg-gradient-to-r from-[#DFB962] via-[#CEA346] to-[#BE9032] text-[#17120F] font-bold shadow-sm'
            : 'text-[#D8CBB8] hover:bg-[#221A14] hover:text-[#FBF4E0] font-medium'
        }`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {!isDeepLeaf && renderSidebarIcon(node.iconKey, leafActive)}
          {!isCollapsed && <span className="truncate">{node.label}</span>}
        </span>
        {!isCollapsed && leafActive && (
          <Pin className="w-3.5 h-3.5 text-[#17120F]/80 shrink-0 rotate-45" />
        )}
      </button>
    );
  };

  const renderPropertySelectorCard = () => (
    <div className="px-3 pt-3 pb-2 shrink-0">
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (hotels.length > 1) setHotelPickerOpen((prev) => !prev);
          }}
          className={`w-full rounded-xl bg-[#211913] border border-[#35291F] ${
            isCollapsed ? 'p-2 flex items-center justify-center' : 'px-3 py-2.5 text-left'
          } hover:border-[#C49A3A]/50 transition cursor-pointer`}
          title={activeHotel?.name || 'DirectStay Property'}
        >
          {isCollapsed ? (
            <Building2 className="w-4 h-4 text-[#DFB962]" />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-[#FBF4E0] truncate leading-snug">
                  {activeHotel?.name || 'DirectStay Hotel'}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#A89376] mt-0.5 truncate">
                  <span className="truncate">{hotelCitySnippet}</span>
                  <span>•</span>
                  <span className="shrink-0">
                    {hotels.length || 1} {hotels.length === 1 ? 'property' : 'properties'}
                  </span>
                </div>
              </div>
              {hotels.length > 1 && (
                <ChevronDown className="w-3.5 h-3.5 text-[#A89376] shrink-0" />
              )}
            </div>
          )}
        </button>

        {!isCollapsed && hotelPickerOpen && hotels.length > 1 && (
          <div className="absolute left-0 right-0 mt-1.5 rounded-xl bg-[#1E1610] border border-[#3C2E22] shadow-xl z-40 py-1 max-h-52 overflow-y-auto">
            {hotels.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  onSelectHotel(h.id);
                  setHotelPickerOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#2A2018] cursor-pointer ${
                  h.id === selectedHotelId ? 'text-[#F5D88A] font-bold' : 'text-[#D8CBB8]'
                }`}
              >
                <span className="truncate">{h.name}</span>
                {h.id === selectedHotelId && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DFB962] shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ==================================================================== */}
      {/* DESKTOP & TABLET LEFT SIDEBAR                                        */}
      {/* ==================================================================== */}
      <aside
        data-testid="directstay-pms-sidebar"
        className={`${
          isCollapsed ? 'w-[72px]' : 'w-[248px]'
        } bg-[#17120F] text-[#E6DCD2] hidden md:flex flex-col justify-between shrink-0 select-none border-r border-[#2B211A] h-screen sticky top-0 transition-all duration-200 z-30 no-print`}
      >
        {/* Top Brand Row + Collapse Toggle */}
        <div className="h-16 px-3.5 border-b border-[#2B211A] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => applyNavigationTarget('dashboard', { activeTab: 'dashboard' })}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer text-left"
          >
            {activeHotel?.logoUrl ? (
              <img
                src={activeHotel.logoUrl}
                alt="Logo"
                className="w-8 h-8 rounded-lg object-cover border border-[#C49A3A]/40 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DFB962] to-[#B08326] text-[#17120F] font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0">
                DS
              </div>
            )}
            {!isCollapsed && (
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="font-serif font-extrabold text-base tracking-tight text-[#FBF4E0] truncate">
                  DirectStay<span className="text-[#DFB962]">.</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#9E886B]">
                  PMS
                </span>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="p-1.5 rounded-lg text-[#A89376] hover:text-[#FBF4E0] hover:bg-[#241C16] transition cursor-pointer shrink-0"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronsRight className="w-4 h-4" />
            ) : (
              <ChevronsLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Property Selector Card */}
        {renderPropertySelectorCard()}

        {/* Scrollable Navigation Tree — Strictly ONLY Approved Menu Items */}
        <nav
          aria-label="DirectStay PMS Navigation"
          className="flex-1 overflow-y-auto px-2.5 py-2 space-y-0.5 scrollbar-thin"
        >
          {visiblePmsTree.map((node) => renderMenuNode(node, 0))}
        </nav>

        {/* Compact Session Footer */}
        <div className="p-2.5 border-t border-[#2B211A] shrink-0">
          <div
            className={`flex items-center ${
              isCollapsed ? 'flex-col gap-2' : 'justify-between gap-2'
            } px-2 py-1.5 rounded-xl bg-[#201813] border border-[#31251C]`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#DFB962] to-[#A67C27] text-[#17120F] font-extrabold text-[11px] flex items-center justify-center shrink-0">
                {userInitials}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#FBF4E0] truncate leading-tight">
                    {loggedInUser || currentRole}
                  </div>
                  <div className="text-[10px] text-[#C49A3A] font-medium truncate">
                    {effectiveRoleForRbac}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-rose-300/80 hover:text-rose-200 hover:bg-rose-950/50 transition cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          {!isCollapsed && (
            <div className="mt-1.5 text-center text-[10px] text-[#8C7355] font-mono tracking-wide select-none">
              DirectStay Luxury Cloud PMS • v2.0
            </div>
          )}
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* MOBILE TOP BAR + RESPONSIVE FULL-TREE SLIDE-OVER DRAWER              */}
      {/* ==================================================================== */}
      <div className="md:hidden sticky top-0 z-40 bg-[#17120F] text-[#FBF4E0] border-b border-[#2B211A] px-3.5 h-14 flex items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="p-2 rounded-xl bg-[#231B15] text-[#DFB962] border border-[#382B20] cursor-pointer shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-serif font-bold text-[#FBF4E0] truncate leading-tight">
              DirectStay<span className="text-[#DFB962]">.</span>{' '}
              <span className="text-[10px] font-sans uppercase tracking-wider text-[#C49A3A]">PMS</span>
            </div>
            <div className="text-[10px] text-[#A89376] truncate">
              {activeHotel?.name || 'DirectStay Property'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {unreadNotificationsCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className="relative p-2 rounded-xl bg-[#231B15] text-[#DFB962] border border-[#382B20]"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              applyNavigationTarget('fo-new-reservation', {
                activeTab: 'frontDesk',
                frontDeskSubTab: 'reservations',
                openNewReservationModal: true,
              })
            }
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#DFB962] to-[#C49A3A] text-[#17120F] font-bold text-[11px] shadow-xs"
          >
            + Reserve
          </button>
        </div>
      </div>

      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex no-print">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative w-[280px] max-w-[85vw] bg-[#17120F] text-[#E6DCD2] h-full flex flex-col justify-between border-r border-[#2B211A] shadow-2xl z-10">
            <div className="h-14 px-4 border-b border-[#2B211A] flex items-center justify-between shrink-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-serif font-extrabold text-base text-[#FBF4E0]">
                  DirectStay<span className="text-[#DFB962]">.</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#9E886B]">
                  PMS
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg text-[#A89376] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {renderPropertySelectorCard()}

            <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
              {visiblePmsTree.map((node) => renderMenuNode(node, 0))}
            </nav>

            <div className="p-3 border-t border-[#2B211A] bg-[#201813]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#DFB962] text-[#17120F] font-extrabold text-[11px] flex items-center justify-center shrink-0">
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#FBF4E0] truncate">
                      {loggedInUser || currentRole}
                    </div>
                    <div className="text-[10px] text-[#C49A3A] truncate">{effectiveRoleForRbac}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    onLogout();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 text-rose-200 border border-rose-800/40 text-[11px] font-semibold flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
              <div className="mt-2 text-center text-[10px] text-[#8C7355] font-mono tracking-wide select-none">
                DirectStay Luxury Cloud PMS • v2.0
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
