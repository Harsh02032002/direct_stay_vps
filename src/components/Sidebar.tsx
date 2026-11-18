import React, { useState } from 'react';
import { UserRole, Hotel, Staff } from '../types';
import {
  useRbacMatrix,
  getAllowedSidebarTabsForRole,
  normalizeRbacRole,
} from '../pms-integrated/utils/rbacPermissions';
import {
  LayoutDashboard,
  Hotel as HotelIcon,
  CalendarDays,
  BookOpen,
  FileSpreadsheet,
  Wallet,
  Landmark,
  ShieldCheck,
  FileText,
  Menu,
  X,
  Users,
  Sparkles,
  Globe,
  LogOut,
  Layers,
  Package,
  ShoppingBag,
  Coins,
  TrendingUp,
  TrendingDown,
  Building2,
  UserCheck,
  UserPlus,
  Clock,
  Receipt,
  CreditCard,
  FileCheck,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Bed,
  Bell,
  Crown,
  ExternalLink,
  Trash2,
  QrCode,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectHotel: (id: string) => void;
  onLogout?: () => void;
  isSuperAdminUser?: boolean;
  loggedInUser?: string;
  unreadNotificationsCount?: number;
  onOpenPublicWebsite?: () => void;
  superAdminSubTab?: 'dashboard' | 'hotels' | 'packages' | 'users' | 'website' | 'blogs' | 'pages' | 'leads';
  onSelectSuperAdminSubTab?: (subTab: 'dashboard' | 'hotels' | 'packages' | 'users' | 'website' | 'blogs' | 'pages' | 'leads') => void;
  ownerSubTab?: 'dashboard' | 'property' | 'bookings' | 'financials' | 'occupancy' | 'staff' | 'subscription' | 'auditLogs';
  onSelectOwnerSubTab?: (subTab: 'dashboard' | 'property' | 'bookings' | 'financials' | 'occupancy' | 'staff' | 'subscription' | 'auditLogs') => void;
  financeSubTab?: string;
  onSelectFinanceSubTab?: (subTab: string) => void;
  frontDeskSubTab?: string;
  onSelectFrontDeskSubTab?: (subTab: string) => void;
  roomSubTab?: string;
  onSelectRoomSubTab?: (subTab: string) => void;
  housekeepingSubTab?: string;
  onSelectHousekeepingSubTab?: (subTab: string) => void;
  posSubTab?: string;
  onSelectPosSubTab?: (subTab: string) => void;
  inventorySubTab?: string;
  onSelectInventorySubTab?: (subTab: string) => void;
  otaSubTab?: string;
  onSelectOtaSubTab?: (subTab: string) => void;
  reportsSubTab?: string;
  onSelectReportsSubTab?: (subTab: string) => void;
  staffSubTab?: string;
  onSelectStaffSubTab?: (subTab: string) => void;
  invoiceSubTab?: string;
  onSelectInvoiceSubTab?: (subTab: string) => void;
  staff?: Staff[];
}

interface NavMenuItem {
  id: string;
  subTab?: string;
  label: string;
  icon: any;
  isParent?: boolean;
  section?: string;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentRole,
  setCurrentRole,
  hotels = [],
  selectedHotelId,
  onSelectHotel,
  onLogout,
  isSuperAdminUser = false,
  loggedInUser,
  unreadNotificationsCount = 0,
  onOpenPublicWebsite,
  superAdminSubTab = 'dashboard',
  onSelectSuperAdminSubTab,
  ownerSubTab = 'dashboard',
  onSelectOwnerSubTab,
  financeSubTab = 'dashboard',
  onSelectFinanceSubTab,
  frontDeskSubTab = 'dashboard',
  onSelectFrontDeskSubTab,
  roomSubTab = 'dashboard',
  onSelectRoomSubTab,
  housekeepingSubTab = 'dashboard',
  onSelectHousekeepingSubTab,
  posSubTab = 'terminal',
  onSelectPosSubTab,
  inventorySubTab = 'dashboard',
  onSelectInventorySubTab,
  otaSubTab = 'channels',
  onSelectOtaSubTab,
  reportsSubTab = 'daily_cash',
  onSelectReportsSubTab,
  staffSubTab = 'directory',
  onSelectStaffSubTab,
  invoiceSubTab = 'all',
  onSelectInvoiceSubTab,
  staff = [],
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mobileSubMenuGroup, setMobileSubMenuGroup] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    frontDesk: true,
    finance: true,
    vouchers: true,
    rooms: false,
    housekeeping: false,
    pos: false,
    inventory: false,
    otaManager: false,
    reports: false,
    staff: false,
    invoice: false,
  });

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const frontDeskSubItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'checkin', label: 'Check-In', icon: UserCheck },
    { id: 'reservations', label: 'Reservations', icon: BookOpen },
    { id: 'prearrival', label: 'Pre-Arrival Desk', icon: Clock },
    { id: 'walkin', label: 'Walk-In Booking', icon: UserPlus },
    { id: 'inhouse', label: 'In-House Guests', icon: Building2 },
    { id: 'agents', label: 'Travel Agents / Partners', icon: Globe },
    { id: 'services', label: 'Guest Services', icon: Sparkles },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
  ];

  const [rbacMatrix] = useRbacMatrix();

  const invoiceSubItems = [
    { id: 'all', label: 'All GST Invoices', icon: Receipt },
    { id: 'booking_only', label: 'Only Booking Bills', icon: FileText },
    { id: 'combined', label: 'Booking + POS / Extra', icon: FileCheck },
    { id: 'unpaid', label: 'Unpaid / Balance Due', icon: Clock },
  ];

  const roomSubItems = [
    { id: 'dashboard', label: 'Rooms Dashboard', icon: LayoutDashboard },
    { id: 'categories', label: 'Room Categories / Types', icon: Layers },
    { id: 'amenities', label: 'Room Amenities', icon: Sparkles },
    { id: 'status', label: 'Room Status Board', icon: Bed },
  ];

  const housekeepingSubItems = [
    { id: 'room_cleaning', label: 'Room Cleaning Queue', icon: Sparkles },
    { id: 'laundry', label: 'Laundry & Linen Desk', icon: ShoppingBag },
    { id: 'lost_found', label: 'Lost & Found Register', icon: Package },
    { id: 'reports', label: 'Staff Productivity', icon: FileSpreadsheet },
  ];

  const posSubItems = [
    { id: 'terminal', label: 'POS Billing Terminal', icon: ShoppingBag },
    { id: 'advance_booking', label: 'POS Advance Booking', icon: CalendarDays },
    { id: 'qr_menu', label: 'Digital Menu QR Code', icon: QrCode },
    { id: 'kds', label: 'Kitchen Display (KDS / KOT)', icon: Clock },
    { id: 'orders', label: 'All Food Orders', icon: Receipt },
    { id: 'tables', label: 'Restaurant Tables', icon: Building2 },
    { id: 'catalog', label: 'Menu & Recipe Master', icon: BookOpen },
    { id: 'reports', label: 'F&B Sales Summary', icon: FileSpreadsheet },
  ];

  const inventorySubItems = [
    { id: 'dashboard', label: 'Store Stock Overview', icon: LayoutDashboard },
    { id: 'products', label: 'Items & Reorder Alerts', icon: Package },
    { id: 'movements', label: 'Stock IN / OUT Register', icon: TrendingUp },
    { id: 'purchases', label: 'Purchase Orders (PO)', icon: Receipt },
    { id: 'suppliers', label: 'Verified Vendors', icon: Building2 },
    { id: 'reports', label: 'Valuation Report', icon: FileSpreadsheet },
  ];

  const otaSubItems = [
    { id: 'travel_agents', label: 'Travel Agents & Partners', icon: Users },
    { id: 'channels', label: 'Connected OTA Channels', icon: Globe },
    { id: 'api_config', label: 'API Configuration', icon: ShieldCheck },
    { id: 'room_mapping', label: 'Room Mapping', icon: Layers },
    { id: 'rate_management', label: 'Rate Management', icon: Coins },
    { id: 'inventory_management', label: 'Inventory Management', icon: Bed },
    { id: 'sync_engine', label: 'Rate & Inventory Sync', icon: TrendingUp },
    { id: 'bookings', label: 'OTA Booking Feed', icon: BookOpen },
    { id: 'commission_revenue', label: 'Commission & Revenue', icon: CircleDollarSign },
    { id: 'logs', label: 'Webhook & API Sync Logs', icon: FileCheck },
  ];

  const financeSubItems: Array<{
    id: string;
    label: string;
    icon: any;
    hasChildren?: boolean;
    children?: Array<{ id: string; label: string; icon: any }>;
  }> = [
    { id: 'dashboard', label: 'Finance Overview', icon: LayoutDashboard },
    { id: 'income', label: 'Income Ledger', icon: TrendingUp },
    { id: 'expenses', label: 'Expense Register', icon: TrendingDown },
    { id: 'petty_cash', label: 'Petty Cash Drawer', icon: Coins },
    { id: 'cash_bank', label: 'Cash & Bank A/c', icon: Landmark },
    {
      id: 'vouchers',
      label: 'Vouchers',
      icon: Receipt,
      hasChildren: true,
      children: [
        { id: 'vouchers_payment', label: 'Payment Voucher', icon: CreditCard },
        { id: 'vouchers_receipt', label: 'Receipt Voucher', icon: FileCheck },
      ],
    },
    { id: 'vendors', label: 'Vendor Payments', icon: Building2 },
    { id: 'owner_payments', label: 'Owner/Director Payments', icon: UserCheck },
    { id: 'reimbursements', label: 'Staff Reimbursements', icon: Wallet },
    { id: 'daily_closing', label: 'Daily Shift Closing', icon: Clock },
    { id: 'pl_reports', label: 'P&L & 5% GST Summary', icon: FileSpreadsheet },
  ];

  const reportsSubItems = [
    { id: 'daily_collection_sheet', label: 'Daily Collection Sheet', icon: FileSpreadsheet },
    { id: 'daily_cash', label: 'Daily Cash Book', icon: Coins },
    { id: 'advance_reservations', label: 'Advance Reservations', icon: BookOpen },
    { id: 'arrivals_departures', label: 'Arrivals & Departures', icon: Users },
    { id: 'inhouse_guests', label: 'In-House Guests', icon: Building2 },
    { id: 'pending_dues', label: 'Outstanding Payments', icon: Clock },
    { id: 'revenue_journal', label: 'Guest Bills & Revenue', icon: TrendingUp },
    { id: 'night_audit', label: 'Night Audit Flash', icon: FileSpreadsheet },
    { id: 'ota_payments', label: 'OTA Payout Reconciliation', icon: Globe },
    { id: 'gst_tax', label: 'GSTR-1 Tax (5% GST)', icon: Receipt },
    { id: 'police_sarai', label: 'Police Sarai / C-Form', icon: ShieldCheck },
    { id: 'water_logs', label: 'Water Bottle Logs', icon: Sparkles },
  ];

  const staffSubItems = [
    { id: 'directory', label: 'Staff', icon: Users },
    { id: 'salary', label: 'Salary', icon: Coins },
  ];

  const menuItems: NavMenuItem[] = [
    { id: 'dashboard', label: 'PMS Overview', icon: LayoutDashboard, section: 'CORE OPERATIONS' },
    { id: 'frontDesk', label: 'Front Desk', icon: HotelIcon, isParent: true },
    { id: 'invoice', label: 'Invoice System', icon: Receipt, isParent: true },
    { id: 'rooms', label: 'Room Management', icon: Bed, isParent: true },
    { id: 'housekeeping', label: 'Housekeeping', icon: Sparkles, isParent: true },
    { id: 'staff', label: 'HRM (Staff & Salary)', icon: Users, isParent: true },
    { id: 'userList', label: 'Guest Profiles & Documents', icon: Users },
    { id: 'pos', label: 'POS Terminal & Food', icon: ShoppingBag, isParent: true, section: 'SERVICES & STORE' },
    { id: 'inventory', label: 'Inventory Store', icon: Package, isParent: true },
    { id: 'otaManager', label: 'OTA Channel Manager', icon: Globe, isParent: true },
    { id: 'finance', label: 'Finance Hub', icon: CircleDollarSign, isParent: true, section: 'FINANCE & GOVERNANCE' },
    { id: 'reports', label: 'Audits & Reports', icon: FileSpreadsheet, isParent: true },
    { id: 'auditLogs', label: 'Owner Audit Logs', icon: ShieldCheck },
    { id: 'notifications', label: 'Notifications Center', icon: Bell, section: 'ACCOUNT & ALERTS' },
    { id: 'profile', label: 'My Profile Settings', icon: Users },
  ];

  const getFilteredMenuItems = (): NavMenuItem[] => {
    const role = currentRole || 'Admin';
    if (role === 'SuperAdmin') {
      return [
        { id: 'superAdminHub', subTab: 'dashboard', label: 'SaaS Overview', icon: LayoutDashboard, section: 'SAAS MANAGEMENT' },
        { id: 'superAdminHub_hotels', subTab: 'hotels', label: 'Hotel Properties', icon: HotelIcon },
        { id: 'superAdminHub_leads', subTab: 'leads', label: 'Sales & Leads CRM', icon: TrendingUp },
        { id: 'superAdminHub_packages', subTab: 'packages', label: 'Packages & Subscriptions', icon: Layers },
        { id: 'superAdminHub_users', subTab: 'users', label: 'User Credentials', icon: Users },
        { id: 'superAdminHub_website', subTab: 'website', label: 'Website CMS', icon: Globe, section: 'PUBLIC WEBSITE & CMS' },
        { id: 'superAdminHub_blogs', subTab: 'blogs', label: 'Blog Management', icon: BookOpen },
        { id: 'superAdminHub_pages', subTab: 'pages', label: 'Custom Pages', icon: FileText },
      ];
    }
    if (role === 'Owner') {
      return [
        ...menuItems.slice(0, 12),
        { id: 'hotelOwnerHub_property', subTab: 'property', label: 'Property Details', icon: Building2, section: 'OWNER GOVERNANCE' },
        { id: 'hotelOwnerHub_subscription', subTab: 'subscription', label: 'Subscription & Billing', icon: CreditCard },
        ...menuItems.slice(12),
      ];
    }
    const staffUsername = typeof window !== 'undefined' ? sessionStorage.getItem('pms_staff_username') : null;
    const matchedStaff =
      staffUsername || (loggedInUser && role !== 'Admin')
        ? staff.find(
            (s) =>
              (staffUsername && s.username && s.username.toLowerCase() === staffUsername.toLowerCase()) ||
              (loggedInUser && s.username && s.username.toLowerCase() === loggedInUser.toLowerCase()) ||
              (loggedInUser && s.name && s.name.toLowerCase() === loggedInUser.toLowerCase())
          )
        : undefined;

    const effectiveStaffRole = matchedStaff?.role || matchedStaff?.designation || role;
    const normalizedStaffRole = normalizeRbacRole(effectiveStaffRole);

    if (normalizedStaffRole) {
      const rbacAllowed = new Set(
        getAllowedSidebarTabsForRole(
          rbacMatrix,
          effectiveStaffRole,
          matchedStaff?.username || staffUsername
        )
      );
      return menuItems.filter((item) => rbacAllowed.has(item.id));
    }

    return menuItems;
  };

  const filteredItems = getFilteredMenuItems();

  const handleSelectFrontDeskTab = (subId: string) => {
    setActiveTab('frontDesk');
    if (onSelectFrontDeskSubTab) onSelectFrontDeskSubTab(subId);
    setIsOpen(false);
  };

  const handleSelectFinanceTab = (subId: string) => {
    setActiveTab('finance');
    if (onSelectFinanceSubTab) onSelectFinanceSubTab(subId);
    setIsOpen(false);
  };

  const activeHotel = hotels.find((h) => h.id === selectedHotelId) || hotels[0];
  const activeHotelName = activeHotel ? activeHotel.name : 'GRAND PAVILION';

  const handleNavClick = (item: NavMenuItem) => {
    if (item.id === 'userList') {
      setActiveTab('userList');
    } else if (item.id.startsWith('superAdminHub') && item.subTab) {
      setActiveTab('superAdminHub');
      if (onSelectSuperAdminSubTab) {
        onSelectSuperAdminSubTab(item.subTab as any);
      }
    } else if (item.id.startsWith('hotelOwnerHub') && item.subTab) {
      setActiveTab('hotelOwnerHub');
      if (onSelectOwnerSubTab) {
        onSelectOwnerSubTab(item.subTab as any);
      }
    } else {
      setActiveTab(item.id);
      if (item.id === 'invoice' && onSelectFrontDeskSubTab) {
        onSelectFrontDeskSubTab('billing');
      }
    }
    setIsOpen(false);
  };

  const portalSubtitle =
    currentRole === 'SuperAdmin'
      ? 'SaaS Master Console'
      : currentRole === 'Owner'
      ? 'Hotel Owner Portal'
      : `${currentRole} Control Desk`;

  const renderExpandableModule = (
    item: NavMenuItem,
    sectionHeader: React.ReactNode,
    isActiveModule: boolean,
    subItems: Array<{ id: string; label: string; icon: any }>,
    currentSubTab: string,
    onSelectSub: (subId: string) => void
  ) => {
    const Icon = item.icon;
    const isExpanded = Boolean(openGroups[item.id]);
    return (
      <React.Fragment key={`${item.id}-accordion`}>
        {sectionHeader}
        <div className="space-y-1 my-0.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab(item.id);
              toggleGroup(item.id);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-[13px] rounded-xl transition-all duration-200 font-sans font-medium cursor-pointer ${
              isActiveModule
                ? 'bg-[#C49A3A] text-[#17120F] font-semibold shadow-sm'
                : 'text-slate-200 hover:bg-luxury-brown-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Icon className={`w-4 h-4 shrink-0 ${isActiveModule ? 'text-luxury-brown-950' : 'text-luxury-gold-400'}`} />
              <span className="truncate">{item.label}</span>
            </div>
            {isExpanded ? (
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${isActiveModule ? 'text-luxury-brown-950' : 'text-luxury-gold-400'}`} />
            ) : (
              <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isActiveModule ? 'text-luxury-brown-950' : 'text-luxury-gold-400'}`} />
            )}
          </button>

          {isExpanded && (
            <div className="pl-3 space-y-0.5 border-l-2 border-luxury-gold-500/30 ml-4 my-1">
              {subItems.map((sub) => {
                const SubIcon = sub.icon;
                const isSubActive = isActiveModule && currentSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      onSelectSub(sub.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg transition-all text-left font-sans cursor-pointer ${
                      isSubActive
                        ? 'bg-luxury-gold-500 text-luxury-brown-950 font-bold shadow-2xs'
                        : 'text-luxury-brown-300 hover:text-white hover:bg-luxury-brown-800/80'
                    }`}
                  >
                    <SubIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{sub.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </React.Fragment>
    );
  };

  const getMobileSubItemsForModule = (moduleId: string): {
    title: string;
    items: Array<{ id: string; label: string; icon: any; isActive: boolean; onSelect: () => void }>;
  } | null => {
    if (moduleId === 'frontDesk') {
      const isFrontDeskActive =
        activeTab === 'frontDesk' ||
        ['todayBookings', 'bookings', 'checkin', 'calendar', 'dailyReport', 'policies'].includes(activeTab);
      return {
        title: 'Front Desk Operations',
        items: frontDeskSubItems.map((sub) => ({
          id: sub.id,
          label: sub.label,
          icon: sub.icon,
          isActive: isFrontDeskActive && frontDeskSubTab === sub.id,
          onSelect: () => {
            handleSelectFrontDeskTab(sub.id);
            setMobileSubMenuGroup(null);
          },
        })),
      };
    }
    if (moduleId === 'invoice') {
      return {
        title: 'Invoice System',
        items: invoiceSubItems.map((sub) => ({
          id: sub.id,
          label: sub.label,
          icon: sub.icon,
          isActive: activeTab === 'invoice' && invoiceSubTab === sub.id,
          onSelect: () => {
            setActiveTab('invoice');
            if (onSelectInvoiceSubTab) onSelectInvoiceSubTab(sub.id);
            setMobileSubMenuGroup(null);
          },
        })),
      };
    }
    if (moduleId === 'rooms') {
      return {
        title: 'Room Management',
        items: roomSubItems.map((sub) => ({
          id: sub.id,
          label: sub.label,
          icon: sub.icon,
          isActive: activeTab === 'rooms' && roomSubTab === sub.id,
          onSelect: () => {
            setActiveTab('rooms');
            if (onSelectRoomSubTab) onSelectRoomSubTab(sub.id);
            setMobileSubMenuGroup(null);
          },
        })),
      };
    }
    if (moduleId === 'housekeeping') {
      return {
        title: 'Housekeeping',
        items: housekeepingSubItems.map((sub) => ({
          id: sub.id,
          label: sub.label,
          icon: sub.icon,
          isActive: activeTab === 'housekeeping' && housekeepingSubTab === sub.id,
          onSelect: () => {
            setActiveTab('housekeeping');
            if (onSelectHousekeepingSubTab) onSelectHousekeepingSubTab(sub.id);
            setMobileSubMenuGroup(null);
          },
        })),
      };
    }
    if (moduleId === 'pos') {
      return {
        title: 'POS & Food Service',
        items: posSubItems.map((sub) => ({
          id: sub.id,
          label: sub.label,
          icon: sub.icon,
          isActive: activeTab === 'pos' && posSubTab === sub.id,
          onSelect: () => {
            setActiveTab('pos');
            if (onSelectPosSubTab) onSelectPosSubTab(sub.id);
            setMobileSubMenuGroup(null);
          },
        })),
      };
    }
    if (moduleId === 'inventory') {
      return {
        title: 'Inventory Management',
        items: inventorySubItems.map((sub) => ({
          id: sub.id,
          label: sub.label,
          icon: sub.icon,
          isActive: activeTab === 'inventory' && inventorySubTab === sub.id,
          onSelect: () => {
            setActiveTab('inventory');
            if (onSelectInventorySubTab) onSelectInventorySubTab(sub.id);
            setMobileSubMenuGroup(null);
          },
        })),
      };
    }
    if (moduleId === 'otaManager') {
      return {
        title: 'OTA Channel Manager',
        items: otaSubItems.map((sub) => ({
          id: sub.id,
          label: sub.label,
          icon: sub.icon,
          isActive: activeTab === 'otaManager' && otaSubTab === sub.id,
          onSelect: () => {
            setActiveTab('otaManager');
            if (onSelectOtaSubTab) onSelectOtaSubTab(sub.id);
            setMobileSubMenuGroup(null);
          },
        })),
      };
    }
    if (moduleId === 'finance') {
      const flatFinance: Array<{ id: string; label: string; icon: any; isActive: boolean; onSelect: () => void }> = [];
      financeSubItems.forEach((sub) => {
        if (sub.hasChildren && sub.children) {
          sub.children.forEach((child) => {
            flatFinance.push({
              id: child.id,
              label: child.label,
              icon: child.icon,
              isActive: activeTab === 'finance' && financeSubTab === child.id,
              onSelect: () => {
                handleSelectFinanceTab(child.id);
                setMobileSubMenuGroup(null);
              },
            });
          });
        } else {
          flatFinance.push({
            id: sub.id,
            label: sub.label,
            icon: sub.icon,
            isActive: activeTab === 'finance' && financeSubTab === sub.id,
            onSelect: () => {
              handleSelectFinanceTab(sub.id);
              setMobileSubMenuGroup(null);
            },
          });
        }
      });
      return { title: 'Finance Hub', items: flatFinance };
    }
    if (moduleId === 'reports') {
      return {
        title: 'Audits & Reports',
        items: reportsSubItems.map((sub) => ({
          id: sub.id,
          label: sub.label,
          icon: sub.icon,
          isActive: activeTab === 'reports' && reportsSubTab === sub.id,
          onSelect: () => {
            setActiveTab('reports');
            if (onSelectReportsSubTab) onSelectReportsSubTab(sub.id);
            setMobileSubMenuGroup(null);
          },
        })),
      };
    }
    if (moduleId === 'staff') {
      return {
        title: 'Staff Workspace',
        items: staffSubItems.map((sub) => ({
          id: sub.id,
          label: sub.label,
          icon: sub.icon,
          isActive: activeTab === 'staff' && staffSubTab === sub.id,
          onSelect: () => {
            setActiveTab('staff');
            if (onSelectStaffSubTab) onSelectStaffSubTab(sub.id);
            setMobileSubMenuGroup(null);
          },
        })),
      };
    }
    return null;
  };

  const activeMobileSubSheet = mobileSubMenuGroup ? getMobileSubItemsForModule(mobileSubMenuGroup) : null;

  return (
    <>
      {/* Mobile Header bar (Top Identity & Quick Actions Only — Sidebar Items are in Bottom Navbar on Mobile) */}
      <div className="bg-[#17120F] border-b border-luxury-gold-500/25 text-white px-3 py-2.5 flex justify-between items-center gap-2 md:hidden no-print sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 bg-gradient-to-br from-[#C49A3A] to-[#A67C20] rounded-xl text-[#17120F] flex items-center justify-center shrink-0 shadow-xs">
            {currentRole === 'SuperAdmin' ? (
              <ShieldCheck className="w-4 h-4" />
            ) : currentRole === 'Owner' ? (
              <Crown className="w-4 h-4" />
            ) : (
              <HotelIcon className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[13px] sm:text-sm font-serif font-bold tracking-wide truncate text-white leading-tight">
              {currentRole === 'SuperAdmin' ? 'Imperial SaaS Hub' : activeHotelName}
            </h1>
            <span className="text-[9px] uppercase tracking-wider font-mono text-luxury-gold-300 block truncate leading-tight mt-0.5">
              {portalSubtitle}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onOpenPublicWebsite && (
            <button
              type="button"
              onClick={() => {
                setMobileSubMenuGroup(null);
                onOpenPublicWebsite();
              }}
              className="w-8 h-8 flex items-center justify-center bg-luxury-brown-800 hover:bg-luxury-brown-700 text-luxury-gold-300 rounded-xl border border-luxury-gold-500/15"
              aria-label="Public Website"
              title="Public Website"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMobileSubMenuGroup(null);
              setActiveTab('notifications');
            }}
            className="relative w-8 h-8 flex items-center justify-center bg-luxury-brown-800 hover:bg-luxury-brown-700 text-luxury-gold-300 rounded-xl border border-luxury-gold-500/15"
            aria-label="Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-3.5 px-1 rounded-full bg-rose-500 text-white text-[8px] font-mono font-bold flex items-center justify-center">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileSubMenuGroup(null);
              setActiveTab('profile');
            }}
            className="w-8 h-8 flex items-center justify-center bg-luxury-brown-800 hover:bg-luxury-brown-700 text-luxury-gold-300 rounded-xl border border-luxury-gold-500/15"
            aria-label="Profile"
            title="Profile Settings"
          >
            <UserCheck className="w-3.5 h-3.5" />
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-8 h-8 flex items-center justify-center bg-rose-950/70 hover:bg-rose-900 text-rose-200 rounded-xl border border-rose-500/35"
              aria-label="Sign Out"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Sidebar main body — DESKTOP ONLY (md:flex), 100% Untouched on Desktop */}
      <aside
        className="hidden md:flex bg-luxury-brown-900 border-r border-luxury-gold-500/20 text-white w-64 p-4 flex-col justify-between md:static md:h-screen shrink-0 no-print"
      >
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex items-center gap-3 border-b border-luxury-gold-500/15 pb-4 mb-3 shrink-0">
            {currentRole === 'SuperAdmin' ? (
              <div className="w-10 h-10 bg-gradient-to-br from-[#C49A3A] to-[#A67C20] rounded-xl flex items-center justify-center text-[#17120F] font-serif font-bold text-base shadow-md border border-luxury-gold-300/30 shrink-0">
                <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
              </div>
            ) : activeHotel?.logoUrl ? (
              <img
                src={activeHotel.logoUrl}
                alt={activeHotelName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-cover border border-luxury-gold-500/30 shadow-md shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-[#C49A3A] to-[#A67C20] rounded-xl flex items-center justify-center text-[#17120F] shadow-md shrink-0">
                {currentRole === 'Owner' ? <Crown className="w-5 h-5" /> : <HotelIcon className="w-5 h-5" />}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-serif font-bold tracking-wide text-luxury-beige-50 truncate">
                {currentRole === 'SuperAdmin' ? 'Imperial SaaS Hub' : activeHotelName}
              </h1>
              <span className="text-[9.5px] uppercase font-mono tracking-[0.16em] text-luxury-gold-300 font-bold block truncate">
                {portalSubtitle}
              </span>
            </div>
          </div>

          {/* Super Admin Active Hotel Workspace Banner (Only shown when SuperAdmin has opened a hotel PMS) */}
          {isSuperAdminUser && currentRole !== 'SuperAdmin' && (
            <div className="bg-luxury-brown-800/95 border-l-2 border-l-luxury-gold-500 p-2.5 rounded-r-xl mb-3 shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase text-luxury-gold-300 flex items-center gap-1 font-bold">
                  <Sparkles className="w-3 h-3 text-luxury-gold-400" /> Viewing Hotel PMS
                </span>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              </div>
              <div className="text-xs font-serif font-bold text-white truncate">
                {activeHotelName}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCurrentRole('SuperAdmin');
                  setActiveTab('superAdminHub');
                }}
                className="w-full text-center text-xs bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold py-1.5 px-2 rounded-lg cursor-pointer transition-all shadow-xs"
              >
                ← Return to Super Admin
              </button>
            </div>
          )}

          {/* Scrollable Navigation Links */}
          <nav className="space-y-1 overflow-y-auto pr-1 flex-1">
            {filteredItems.map((item) => {
              const sectionHeader = item.section ? (
                <div
                  key={`sec-${item.section}`}
                  className="pt-3 pb-1 px-2.5 text-[9.5px] font-mono uppercase tracking-[0.18em] text-luxury-gold-400/75 font-bold select-none"
                >
                  {item.section}
                </div>
              ) : null;

              if (item.id === 'frontDesk') {
                const isFrontDeskActive =
                  activeTab === 'frontDesk' ||
                  ['todayBookings', 'bookings', 'checkin', 'calendar', 'dailyReport', 'policies'].includes(activeTab);
                return (
                  <React.Fragment key="frontdesk-accordion">
                    {sectionHeader}
                    <div className="space-y-1 my-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('frontDesk');
                          if (frontDeskSubTab === 'billing' && onSelectFrontDeskSubTab) {
                            onSelectFrontDeskSubTab('dashboard');
                          }
                          toggleGroup('frontDesk');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-[13px] rounded-xl transition-all duration-200 font-sans font-medium cursor-pointer ${
                          isFrontDeskActive
                            ? 'bg-[#C49A3A] text-[#17120F] font-semibold shadow-sm'
                            : 'text-slate-200 hover:bg-luxury-brown-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <HotelIcon className={`w-4 h-4 shrink-0 ${isFrontDeskActive ? 'text-luxury-brown-950' : 'text-luxury-gold-400'}`} />
                          <span>Front Desk</span>
                        </div>
                        {openGroups.frontDesk ? (
                          <ChevronDown className={`w-3.5 h-3.5 ${isFrontDeskActive ? 'text-luxury-brown-950' : 'text-luxury-gold-400'}`} />
                        ) : (
                          <ChevronRight className={`w-3.5 h-3.5 ${isFrontDeskActive ? 'text-luxury-brown-950' : 'text-luxury-gold-400'}`} />
                        )}
                      </button>

                      {openGroups.frontDesk && (
                        <div className="pl-3 space-y-0.5 border-l-2 border-luxury-gold-500/30 ml-4 my-1">
                          {frontDeskSubItems.map((sub) => {
                            const SubIcon = sub.icon;
                            const isSubActive = isFrontDeskActive && frontDeskSubTab === sub.id;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => handleSelectFrontDeskTab(sub.id)}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg transition-all text-left font-sans cursor-pointer ${
                                  isSubActive
                                    ? 'bg-luxury-gold-500 text-luxury-brown-950 font-bold shadow-2xs'
                                    : 'text-luxury-brown-300 hover:text-white hover:bg-luxury-brown-800/80'
                                }`}
                              >
                                <SubIcon className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{sub.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              }

              if (item.id === 'invoice') {
                return renderExpandableModule(
                  item,
                  sectionHeader,
                  activeTab === 'invoice',
                  invoiceSubItems,
                  invoiceSubTab,
                  (subId) => {
                    if (onSelectInvoiceSubTab) onSelectInvoiceSubTab(subId);
                  }
                );
              }

              if (item.id === 'rooms') {
                return renderExpandableModule(
                  item,
                  sectionHeader,
                  activeTab === 'rooms',
                  roomSubItems,
                  roomSubTab,
                  (subId) => {
                    if (onSelectRoomSubTab) onSelectRoomSubTab(subId);
                  }
                );
              }

              if (item.id === 'housekeeping') {
                return renderExpandableModule(
                  item,
                  sectionHeader,
                  activeTab === 'housekeeping',
                  housekeepingSubItems,
                  housekeepingSubTab,
                  (subId) => {
                    setActiveTab('housekeeping');
                    if (onSelectHousekeepingSubTab) onSelectHousekeepingSubTab(subId);
                  }
                );
              }

              if (item.id === 'pos') {
                return renderExpandableModule(
                  item,
                  sectionHeader,
                  activeTab === 'pos',
                  posSubItems,
                  posSubTab,
                  (subId) => {
                    if (onSelectPosSubTab) onSelectPosSubTab(subId);
                  }
                );
              }

              if (item.id === 'inventory') {
                return renderExpandableModule(
                  item,
                  sectionHeader,
                  activeTab === 'inventory',
                  inventorySubItems,
                  inventorySubTab,
                  (subId) => {
                    if (onSelectInventorySubTab) onSelectInventorySubTab(subId);
                  }
                );
              }

              if (item.id === 'otaManager') {
                return renderExpandableModule(
                  item,
                  sectionHeader,
                  activeTab === 'otaManager',
                  otaSubItems,
                  otaSubTab,
                  (subId) => {
                    if (onSelectOtaSubTab) onSelectOtaSubTab(subId);
                  }
                );
              }

              if (item.id === 'finance') {
                const isFinanceActive = activeTab === 'finance';
                return (
                  <React.Fragment key="finance-accordion">
                    {sectionHeader}
                    <div className="space-y-1 my-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('finance');
                          toggleGroup('finance');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-[13px] rounded-xl transition-all duration-200 font-sans font-medium cursor-pointer ${
                          isFinanceActive
                            ? 'bg-[#C49A3A] text-[#17120F] font-semibold shadow-sm'
                            : 'text-slate-200 hover:bg-luxury-brown-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <CircleDollarSign className={`w-4 h-4 shrink-0 ${isFinanceActive ? 'text-luxury-brown-950' : 'text-luxury-gold-400'}`} />
                          <span>Finance Hub</span>
                        </div>
                        {openGroups.finance ? (
                          <ChevronDown className={`w-3.5 h-3.5 ${isFinanceActive ? 'text-luxury-brown-950' : 'text-luxury-gold-400'}`} />
                        ) : (
                          <ChevronRight className={`w-3.5 h-3.5 ${isFinanceActive ? 'text-luxury-brown-950' : 'text-luxury-gold-400'}`} />
                        )}
                      </button>

                      {openGroups.finance && (
                        <div className="pl-3 space-y-0.5 border-l-2 border-luxury-gold-500/30 ml-4 my-1">
                          {financeSubItems.map((sub) => {
                            const SubIcon = sub.icon;
                            if (sub.hasChildren && sub.children) {
                              return (
                                <div key={sub.id} className="space-y-1 my-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleGroup('vouchers')}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] text-luxury-gold-300 font-bold hover:text-white transition-colors cursor-pointer"
                                  >
                                    <span className="flex items-center gap-2">
                                      <SubIcon className="w-3.5 h-3.5 text-luxury-gold-400" /> {sub.label}
                                    </span>
                                    {openGroups.vouchers ? (
                                      <ChevronDown className="w-3 h-3 text-luxury-gold-400" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3 text-luxury-gold-400" />
                                    )}
                                  </button>
                                  {openGroups.vouchers && (
                                    <div className="pl-3 space-y-1 border-l border-luxury-gold-500/20 ml-2">
                                      {sub.children.map((child) => {
                                        const ChildIcon = child.icon;
                                        const isChildActive = isFinanceActive && financeSubTab === child.id;
                                        return (
                                          <button
                                            key={child.id}
                                            type="button"
                                            onClick={() => handleSelectFinanceTab(child.id)}
                                            className={`w-full flex items-center gap-2 px-2 py-1 text-xs rounded-lg transition-all text-left font-sans cursor-pointer ${
                                              isChildActive
                                                ? 'bg-luxury-gold-400 text-luxury-brown-950 font-bold'
                                                : 'text-luxury-brown-300 hover:text-white hover:bg-luxury-brown-800/80'
                                            }`}
                                          >
                                            <ChildIcon className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{child.label}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            const isSubActive = isFinanceActive && financeSubTab === sub.id;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => handleSelectFinanceTab(sub.id)}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg transition-all text-left font-sans cursor-pointer ${
                                  isSubActive
                                    ? 'bg-luxury-gold-500 text-luxury-brown-950 font-bold shadow-2xs'
                                    : 'text-luxury-brown-300 hover:text-white hover:bg-luxury-brown-800/80'
                                }`}
                              >
                                <SubIcon className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{sub.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              }

              if (item.id === 'reports') {
                return renderExpandableModule(
                  item,
                  sectionHeader,
                  activeTab === 'reports',
                  reportsSubItems,
                  reportsSubTab,
                  (subId) => {
                    if (onSelectReportsSubTab) onSelectReportsSubTab(subId);
                  }
                );
              }

              if (item.id === 'staff') {
                return renderExpandableModule(
                  item,
                  sectionHeader,
                  activeTab === 'staff',
                  staffSubItems,
                  staffSubTab,
                  (subId) => {
                    setActiveTab('staff');
                    if (onSelectStaffSubTab) onSelectStaffSubTab(subId);
                  }
                );
              }

              const Icon = item.icon;
              const isActive =
                item.id === 'userList'
                  ? activeTab === 'userList'
                  : item.id.startsWith('superAdminHub') && item.subTab
                  ? activeTab === 'superAdminHub' && superAdminSubTab === item.subTab
                  : item.id.startsWith('hotelOwnerHub') && item.subTab
                  ? activeTab === 'hotelOwnerHub' && ownerSubTab === item.subTab
                  : activeTab === item.id;

              const showNotifBadge = item.id === 'notifications' && unreadNotificationsCount > 0;

              return (
                <React.Fragment key={item.id}>
                  {sectionHeader}
                  <button
                    type="button"
                    onClick={() => handleNavClick(item)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] rounded-xl transition-all duration-200 font-sans font-medium cursor-pointer ${
                      isActive
                        ? 'bg-[#C49A3A] text-[#17120F] font-semibold shadow-sm'
                        : 'text-slate-200 hover:bg-luxury-brown-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-luxury-brown-950' : 'text-luxury-gold-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {showNotifBadge && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                          isActive
                            ? 'bg-luxury-brown-950 text-luxury-gold-300'
                            : 'bg-luxury-gold-500 text-luxury-brown-950'
                        }`}
                      >
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Bottom system credentials & User Profile card */}
        <div className="pt-3 mt-3 border-t border-luxury-gold-500/15 space-y-2.5 shrink-0">
          {onOpenPublicWebsite && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenPublicWebsite();
              }}
              className="w-full flex items-center justify-between px-3 py-2 bg-luxury-brown-800/70 hover:bg-luxury-brown-800 border border-luxury-gold-500/20 rounded-xl text-[11px] font-mono text-luxury-gold-300 hover:text-white transition-colors cursor-pointer"
            >
              <span>Public Website (/)</span>
              <ExternalLink className="w-3.5 h-3.5 text-luxury-gold-400" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setIsOpen(false);
            }}
            className="w-full p-2.5 bg-luxury-brown-950 hover:bg-black/60 border border-luxury-gold-500/15 rounded-xl text-left transition-colors cursor-pointer"
            title="Open Profile & Security Settings"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-luxury-gold-500/20 border border-luxury-gold-500 flex items-center justify-center text-luxury-gold-300 text-xs font-bold leading-none shrink-0 font-mono uppercase">
                {loggedInUser
                  ? loggedInUser
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                  : currentRole === 'SuperAdmin'
                  ? 'SA'
                  : currentRole === 'Owner'
                  ? 'HO'
                  : 'AD'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-luxury-beige-50 text-xs font-sans font-semibold truncate">
                  {loggedInUser ||
                    (currentRole === 'SuperAdmin'
                      ? 'Super Admin'
                      : currentRole === 'Owner'
                      ? 'Hotel Owner'
                      : 'Property Admin')}
                </p>
                <p className="text-[#C49A3A] text-[10px] tracking-wide font-mono leading-none capitalize truncate mt-0.5">
                  {currentRole === 'SuperAdmin'
                    ? 'SaaS Executive'
                    : currentRole === 'Owner'
                    ? 'Property Owner'
                    : `${currentRole}`}
                </p>
              </div>
            </div>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-500/25 hover:border-rose-500/45 text-rose-200 hover:text-white text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out Session</span>
            </button>
          )}
        </div>
      </aside>

      {/* MOBILE ONLY: Sub-Menu Pop-up Sheet Above Bottom Navbar */}
      {activeMobileSubSheet && (
        <>
          <div
            onClick={() => setMobileSubMenuGroup(null)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden no-print"
          />
          <div className="fixed bottom-[68px] inset-x-2 z-50 md:hidden no-print bg-[#17120F] border border-luxury-gold-500/35 rounded-2xl p-3 shadow-2xl max-h-[55vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-luxury-gold-500/20 shrink-0">
              <span className="text-xs font-serif font-bold text-luxury-gold-300 tracking-wide">
                {activeMobileSubSheet.title}
              </span>
              <button
                type="button"
                onClick={() => setMobileSubMenuGroup(null)}
                className="p-1 rounded-lg bg-white/10 text-luxury-beige-200 hover:text-white"
                aria-label="Close submenu"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
              {activeMobileSubSheet.items.map((sub) => {
                const SubIcon = sub.icon;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={sub.onSelect}
                    className={`flex items-center gap-2 px-2.5 py-2 text-[11px] rounded-xl transition-all text-left font-sans cursor-pointer whitespace-normal ${
                      sub.isActive
                        ? 'bg-[#C49A3A] text-[#17120F] font-bold shadow-xs'
                        : 'bg-luxury-brown-800/70 text-luxury-beige-100 hover:bg-luxury-brown-800'
                    }`}
                  >
                    <SubIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="leading-tight line-clamp-2 whitespace-normal">{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* MOBILE ONLY: Fixed Bottom Navigation Bar containing all Sidebar Items (md:hidden) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        className="fixed bottom-0 inset-x-0 z-50 md:hidden no-print bg-[#17120F] border-t border-luxury-gold-500/30 shadow-[0_-8px_28px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center overflow-x-auto px-2 py-1.5 gap-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const hasSubMenu = [
              'frontDesk',
              'invoice',
              'rooms',
              'housekeeping',
              'pos',
              'inventory',
              'otaManager',
              'finance',
              'reports',
              'staff',
            ].includes(item.id);

            const isItemActive =
              item.id === 'userList'
                ? activeTab === 'userList'
                : item.id.startsWith('superAdminHub') && item.subTab
                ? activeTab === 'superAdminHub' && superAdminSubTab === item.subTab
                : item.id.startsWith('hotelOwnerHub') && item.subTab
                ? activeTab === 'hotelOwnerHub' && ownerSubTab === item.subTab
                : item.id === 'frontDesk'
                ? activeTab === 'frontDesk' ||
                  ['todayBookings', 'bookings', 'checkin', 'calendar', 'dailyReport', 'policies'].includes(activeTab)
                : activeTab === item.id;

            const showBadge = item.id === 'notifications' && unreadNotificationsCount > 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (hasSubMenu) {
                    setActiveTab(item.id);
                    if (item.id === 'frontDesk' && frontDeskSubTab === 'billing' && onSelectFrontDeskSubTab) {
                      onSelectFrontDeskSubTab('dashboard');
                    }
                    setMobileSubMenuGroup((prev) => (prev === item.id ? null : item.id));
                  } else {
                    setMobileSubMenuGroup(null);
                    handleNavClick(item);
                  }
                }}
                className={`relative flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl min-w-[66px] shrink-0 transition-all cursor-pointer ${
                  isItemActive
                    ? 'bg-[#C49A3A] text-[#17120F] font-bold shadow-xs'
                    : 'text-luxury-beige-200 hover:bg-luxury-brown-800/80 hover:text-white'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isItemActive ? 'text-[#17120F]' : 'text-luxury-gold-400'
                    }`}
                  />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-3.5 px-1 rounded-full bg-rose-500 text-white text-[8px] font-mono font-bold flex items-center justify-center">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] leading-tight mt-1 truncate max-w-[70px]">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
