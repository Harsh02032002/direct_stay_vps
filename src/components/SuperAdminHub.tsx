import React, { useState } from 'react';
import { Hotel, Room, Booking, Invoice, UserRole, SystemWebsiteConfig, Testimonial, Staff, SaaSPackage, PackageModulePermissions, CustomPage, WebsiteHeroPillar, WebsiteFeatureCard, WebsitePricingCard, WebsiteVisionPillar, WebsiteCustomSection, WebsiteCustomSectionItem, WebsiteBlogPost, SubscriptionInvoice } from '../types';
import { INITIAL_SAAS_PACKAGES, INITIAL_CUSTOM_PAGES, INITIAL_SYSTEM_WEBSITE, savePmsData } from '../utils/dummyData';
import { sha256 } from '../utils/crypto';
import SubscriptionInvoiceModal from './SubscriptionInvoiceModal';
import { 
  Plus, Hotel as HotelIcon, Trash2, ArrowRight, ArrowLeft, TrendingUp, ShieldAlert,
  Users, Layers, DollarSign, ExternalLink, Sparkles, Building, Phone, Mail,
  Globe, MapPin, X, Save, PlusCircle, CheckCircle,
  Calendar, AlertCircle, CreditCard, PieChart, BarChart2, Activity, Clock, Percent,
  Edit, Eye, EyeOff, RefreshCw, Sliders, Shield, CheckSquare, UserCheck, UserX, UserCog, UserPlus, Search, Key, Lock, Link, Unlink, User, Package, Check, AlertTriangle, FileText, Image as ImageIcon, BookOpen
} from 'lucide-react';
import { showToast } from '../utils/toast';
import { syncAllToSupabase } from '../utils/supabaseClient';
import { getConversionEventsLog } from '../utils/seoManager';

export interface HotelAdminUser {
  id: string;
  name: string;
  username: string;
  password?: string;
  email: string;
  mobile: string;
  hotelId: string | null;
  hotelName: string;
  status: 'Approved' | 'Pending' | 'Suspended' | 'Active' | 'Rejected';
  role: string;
}

interface SuperAdminHubProps {
  hotels: Hotel[];
  packages?: SaaSPackage[];
  onUpdatePackages?: (updated: SaaSPackage[]) => void;
  customPages?: CustomPage[];
  onUpdateCustomPages?: (updatedPages: CustomPage[]) => void;
  activeSubTab?: 'dashboard' | 'hotels' | 'packages' | 'users' | 'leads' | 'website' | 'blogs' | 'pages';
  onSubTabChange?: (tab: 'dashboard' | 'hotels' | 'packages' | 'users' | 'leads' | 'website' | 'blogs' | 'pages') => void;
  rawRooms: Room[];
  rawBookings: Booking[];
  rawInvoices: Invoice[];
  rawStaff?: Staff[];
  onUpdateStaff?: (updatedStaff: Staff[]) => void;
  selectedHotelId: string;
  onSelectHotel: (id: string) => void;
  onAddHotel: (newHotel: Hotel, template: 'Boutique' | 'Luxury' | 'Budget') => void;
  onDeleteHotel: (id: string) => void;
  setCurrentRole: (role: UserRole) => void;
  setActiveTab: (tab: string) => void;
  systemWebsite: SystemWebsiteConfig;
  onUpdateSystemWebsite: (updated: SystemWebsiteConfig) => void;
  onUpdateHotels?: (updatedHotels: Hotel[]) => void;
}

export default function SuperAdminHub({
  hotels,
  packages,
  onUpdatePackages,
  customPages,
  onUpdateCustomPages,
  activeSubTab: propActiveSubTab,
  onSubTabChange,
  rawRooms,
  rawBookings,
  rawInvoices,
  rawStaff = [],
  onUpdateStaff,
  selectedHotelId,
  onSelectHotel,
  onAddHotel,
  onDeleteHotel,
  setCurrentRole,
  setActiveTab,
  systemWebsite,
  onUpdateSystemWebsite,
  onUpdateHotels
}: SuperAdminHubProps) {
  const [internalSubTab, setInternalSubTab] = useState<'dashboard' | 'hotels' | 'packages' | 'users' | 'leads' | 'website' | 'blogs' | 'pages'>('dashboard');
  const activeSubTab = propActiveSubTab || internalSubTab;
  const setActiveSubTab = (tab: 'dashboard' | 'hotels' | 'packages' | 'users' | 'leads' | 'website' | 'blogs' | 'pages') => {
    setInternalSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  // Salesperson CRM & Trial Lead Management State
  const LEAD_STATUS_OPTIONS = [
    'New Trial',
    'Setup Pending',
    'Active Trial',
    'Demo Booked',
    'Demo Completed',
    'Follow-Up Required',
    'Payment Pending',
    'Paid Customer',
    'Trial Expired',
    'Not Interested'
  ] as const;

  const [crmLeads, setCrmLeads] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('pms_sales_leads');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [deletedLeadIds, setDeletedLeadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pms_deleted_lead_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [crmConversionTick, setCrmConversionTick] = useState(0);

  React.useEffect(() => {
    const syncLeadsFromStorage = () => {
      try {
        const saved = localStorage.getItem('pms_sales_leads');
        if (saved) setCrmLeads(JSON.parse(saved));
        const savedDeleted = localStorage.getItem('pms_deleted_lead_ids');
        if (savedDeleted) setDeletedLeadIds(JSON.parse(savedDeleted));
        setCrmConversionTick((t) => t + 1);
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', syncLeadsFromStorage);
    window.addEventListener('focus', syncLeadsFromStorage);
    return () => {
      window.removeEventListener('storage', syncLeadsFromStorage);
      window.removeEventListener('focus', syncLeadsFromStorage);
    };
  }, []);
  const [crmStatusFilter, setCrmStatusFilter] = useState<string>('All');
  const [crmExpiryFilter, setCrmExpiryFilter] = useState<'all' | 'expiring48h' | 'activeTrial' | 'expired'>('all');
  const [crmSourceFilter, setCrmSourceFilter] = useState<string>('All');
  const [crmSearch, setCrmSearch] = useState<string>('');
  const [crmDateFrom, setCrmDateFrom] = useState<string>('');
  const [crmDateTo, setCrmDateTo] = useState<string>('');
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [leadNoteDraft, setLeadNoteDraft] = useState<string>('');
  const [leadNextFollowUpDraft, setLeadNextFollowUpDraft] = useState<string>('');

  // Merge hotel records into Salesperson CRM so every trial/registered hotel is tracked
  const mergedSalesLeads = React.useMemo(() => {
    const deletedSet = new Set(deletedLeadIds);
    const byHotelId = new Map<string, any>();
    crmLeads.forEach((l) => {
      if (l.hotelId) byHotelId.set(l.hotelId, l);
    });
    const combined = crmLeads.filter((l) => !deletedSet.has(l.id));
    hotels.forEach((h) => {
      const autoLeadId = `LEAD-HTL-${h.id}`;
      if (!byHotelId.has(h.id) && !deletedSet.has(autoLeadId)) {
        const isTrial = h.subscriptionPlan === 'Trial';
        const endStr = h.subscriptionEndDate || new Date().toISOString().split('T')[0];
        const isExpired = new Date(endStr + 'T23:59:59').getTime() < Date.now();
        combined.push({
          id: autoLeadId,
          hotelId: h.id,
          name: h.ownerName || h.username || 'Hotel Owner',
          hotelName: h.name,
          email: h.emailAddress || '',
          phone: h.phoneNumber || '',
          city: (h.address || '').split(',').slice(-2)[0]?.trim() || 'India',
          roomsCount: h.roomTierLimit || '10-20',
          registrationDate: h.trialStartDate || new Date().toISOString().split('T')[0],
          trialStartDate: h.trialStartDate || new Date().toISOString().split('T')[0],
          trialExpiryDate: endStr,
          lastActivityDate: new Date().toISOString(),
          demoBookingDateTime: '',
          subscriptionStatus: !isTrial ? 'Paid Customer' : isExpired ? 'Trial Expired' : 'Active Trial',
          selectedPlan: h.subscriptionPlan || 'Trial',
          leadSource: 'Direct',
          salespersonNotes: `Auto-synced from Hotel Registry (${h.subscriptionPlan}).`,
          nextFollowUpDate: endStr,
          followUpHistory: []
        });
      }
    });
    return combined;
  }, [crmLeads, hotels, deletedLeadIds]);

  const saveUpdatedCrmLeads = (nextList: any[]) => {
    setCrmLeads(nextList);
    try {
      localStorage.setItem('pms_sales_leads', JSON.stringify(nextList));
    } catch {
      // ignore
    }
  };

  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const handleDeleteLead = (leadObj: any) => {
    if (!window.confirm(`Are you sure you want to delete lead "${leadObj.hotelName || leadObj.name}"?`)) return;
    const nextDeleted = Array.from(new Set([...deletedLeadIds, leadObj.id]));
    setDeletedLeadIds(nextDeleted);
    setSelectedLeadIds((prev) => prev.filter((id) => id !== leadObj.id));
    try {
      localStorage.setItem('pms_deleted_lead_ids', JSON.stringify(nextDeleted));
    } catch {
      // ignore
    }
    const nextList = crmLeads.filter((l) => l.id !== leadObj.id);
    saveUpdatedCrmLeads(nextList);
    showToast(`Deleted lead "${leadObj.hotelName || leadObj.name}".`, 'info');
  };

  const handleBulkDeleteLeads = (targetIds: string[]) => {
    if (targetIds.length === 0) {
      showToast('Please select at least one lead using the checkboxes to delete.', 'warning');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${targetIds.length} selected lead(s)?`)) return;
    const idSet = new Set(targetIds);
    const nextDeleted = Array.from(new Set([...deletedLeadIds, ...targetIds]));
    setDeletedLeadIds(nextDeleted);
    setSelectedLeadIds([]);
    try {
      localStorage.setItem('pms_deleted_lead_ids', JSON.stringify(nextDeleted));
    } catch {
      // ignore
    }
    const nextList = crmLeads.filter((l) => !idSet.has(l.id));
    saveUpdatedCrmLeads(nextList);
    showToast(`✓ Deleted ${targetIds.length} selected lead(s).`, 'success');
  };

  const handleUpdateLeadField = (leadObj: any, patch: Record<string, any>) => {
    const exists = crmLeads.some((l) => l.id === leadObj.id);
    const updatedLead = { ...leadObj, ...patch };
    const nextList = exists
      ? crmLeads.map((l) => (l.id === leadObj.id ? updatedLead : l))
      : [updatedLead, ...crmLeads];
    saveUpdatedCrmLeads(nextList);
    showToast(`Updated lead "${leadObj.hotelName}"`, 'success');
  };

  const handleTriggerTrialFollowUp = (leadObj: any, stageLabel: string, messageTemplate: string) => {
    const historyItem = {
      date: new Date().toISOString(),
      stage: stageLabel,
      channel: 'WhatsApp & Email',
      summary: messageTemplate
    };
    const nextHistory = [historyItem, ...(leadObj.followUpHistory || [])];
    handleUpdateLeadField(leadObj, {
      followUpHistory: nextHistory,
      lastActivityDate: new Date().toISOString()
    });
    const cleanPhone = String(leadObj.phone || '').replace(/\D/g, '');
    const waDigits = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    if (waDigits.length >= 10) {
      window.open(`https://wa.me/${waDigits}?text=${encodeURIComponent(messageTemplate)}`, '_blank', 'noopener,noreferrer');
    }
  };

  // Custom Pages State
  const customPagesList = customPages && customPages.length > 0 ? customPages : INITIAL_CUSTOM_PAGES;
  const [pageSearch, setPageSearch] = useState('');
  const [showPageModal, setShowPageModal] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageContent, setPageContent] = useState('');
  const [pageImageUrl, setPageImageUrl] = useState('');
  const [pageLinkUrl, setPageLinkUrl] = useState('');
  const [pageLinkText, setPageLinkText] = useState('View Link');
  const [pagePublished, setPagePublished] = useState(true);
  const [viewingPage, setViewingPage] = useState<CustomPage | null>(null);
  const [pageToast, setPageToast] = useState<string | null>(null);

  const handleOpenAddPage = () => {
    setEditingPageId(null);
    setPageTitle('');
    setPageSlug('');
    setPageContent('');
    setPageImageUrl('');
    setPageLinkUrl('');
    setPageLinkText('View Link');
    setPagePublished(true);
    setShowPageModal(true);
  };

  const handleOpenEditPage = (p: CustomPage) => {
    setEditingPageId(p.id);
    setPageTitle(p.title);
    setPageSlug(p.slug);
    setPageContent(p.content);
    setPageImageUrl(p.imageUrl || '');
    setPageLinkUrl(p.linkUrl || '');
    setPageLinkText(p.linkText || 'View Link');
    setPagePublished(p.published);
    setShowPageModal(true);
  };

  const handleSavePage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageTitle.trim()) {
      showToast('Page Title is required', 'warning');
      return;
    }

    const generatedSlug = pageSlug.trim() 
      ? pageSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') 
      : pageTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

    let updatedList: CustomPage[];
    if (editingPageId) {
      updatedList = customPagesList.map(p => p.id === editingPageId ? {
        ...p,
        title: pageTitle.trim(),
        slug: generatedSlug,
        content: pageContent.trim(),
        imageUrl: pageImageUrl.trim(),
        linkUrl: pageLinkUrl.trim(),
        linkText: pageLinkText.trim() || 'View Link',
        published: pagePublished
      } : p);
      setPageToast(`✓ Custom page "${pageTitle}" updated successfully.`);
    } else {
      const newPage: CustomPage = {
        id: `page-${Date.now()}`,
        title: pageTitle.trim(),
        slug: generatedSlug,
        content: pageContent.trim(),
        imageUrl: pageImageUrl.trim(),
        linkUrl: pageLinkUrl.trim(),
        linkText: pageLinkText.trim() || 'View Link',
        published: pagePublished,
        createdAt: new Date().toISOString().split('T')[0]
      };
      updatedList = [newPage, ...customPagesList];
      setPageToast(`✓ New custom page "${pageTitle}" published successfully.`);
    }

    if (onUpdateCustomPages) {
      onUpdateCustomPages(updatedList);
    }
    savePmsData({ customPages: updatedList });
    syncAllToSupabase({ customPages: updatedList }).then((res) => {
      if (res?.success) {
        showToast('Custom page saved to database!', 'success');
      }
    }).catch(() => {});
    setShowPageModal(false);
    setTimeout(() => setPageToast(null), 4000);
  };

  const handleDeletePage = (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete custom page "${title}"?`)) return;
    const updated = customPagesList.filter(p => p.id !== id);
    if (onUpdateCustomPages) {
      onUpdateCustomPages(updated);
    }
    savePmsData({ customPages: updated });
    syncAllToSupabase({ customPages: updated }).catch(() => {});
    setPageToast(`✓ Custom page "${title}" deleted.`);
    setTimeout(() => setPageToast(null), 4000);
  };

  const handleTogglePublishPage = (id: string) => {
    const updated = customPagesList.map(p => p.id === id ? { ...p, published: !p.published } : p);
    if (onUpdateCustomPages) {
      onUpdateCustomPages(updated);
    }
    savePmsData({ customPages: updated });
    syncAllToSupabase({ customPages: updated }).catch(() => {});
  };

  const handlePageImageFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setPageImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [hoveredRevenueIndex, setHoveredRevenueIndex] = useState<number | null>(null);
  const [hoveredRegIndex, setHoveredRegIndex] = useState<number | null>(null);
  const [activityFilter, setActivityFilter] = useState<'All' | 'Registration' | 'Approval' | 'Renewal' | 'Upgrade' | 'Suspension'>('All');

  const [hotelFilter, setHotelFilter] = useState<'All' | 'Pending' | 'Approved' | 'Trial' | 'Expiring' | 'Expired' | 'Active' | 'Suspended'>('All');
  const [hotelSearch, setHotelSearch] = useState('');
  const [viewingHotel, setViewingHotel] = useState<Hotel | null>(null);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [packageChangingHotel, setPackageChangingHotel] = useState<Hotel | null>(null);

  // Package Management States
  const packagesList = packages && packages.length > 0 ? packages : INITIAL_SAAS_PACKAGES;
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [pkgFormName, setPkgFormName] = useState('');
  const [pkgFormTagline, setPkgFormTagline] = useState('');
  const [pkgFormBadge, setPkgFormBadge] = useState('Popular');
  const [pkgFormPriceMonthly, setPkgFormPriceMonthly] = useState(1999);
  const [pkgFormPriceYearly, setPkgFormPriceYearly] = useState(19999);
  const [pkgFormMaxRooms, setPkgFormMaxRooms] = useState(25);
  const [pkgFormDesc, setPkgFormDesc] = useState('');
  const [pkgFormModules, setPkgFormModules] = useState<PackageModulePermissions>({
    ota: false,          // OTA Channel Manager (Not for everyone)
    staff: true,         // Staff Management (Not for everyone)
    reports: true,
    cashHandover: true,
    expenses: true,
    invoices: true,
    policies: true,
    website: true,
    pos: true,
    inventory: true
  });

  const [assignPkgModal, setAssignPkgModal] = useState<SaaSPackage | null>(null);
  const [pkgToast, setPkgToast] = useState<string | null>(null);

  const handleOpenAddPackage = () => {
    setEditingPackageId(null);
    setPkgFormName('');
    setPkgFormTagline('');
    setPkgFormBadge('Standard');
    setPkgFormPriceMonthly(1999);
    setPkgFormPriceYearly(19999);
    setPkgFormMaxRooms(25);
    setPkgFormDesc('');
    setPkgFormModules({
      ota: false,
      staff: false,
      reports: true,
      cashHandover: true,
      expenses: true,
      invoices: true,
      policies: true,
      website: true,
      pos: false,
      inventory: false
    });
    setShowPackageModal(true);
  };

  const handleOpenEditPackage = (pkg: SaaSPackage) => {
    setEditingPackageId(pkg.id);
    setPkgFormName(pkg.name);
    setPkgFormTagline(pkg.tagline || '');
    setPkgFormBadge(pkg.badge || 'Popular');
    setPkgFormPriceMonthly(pkg.priceMonthly);
    setPkgFormPriceYearly(pkg.priceYearly);
    setPkgFormMaxRooms(pkg.maxRooms);
    setPkgFormDesc(pkg.description || '');
    setPkgFormModules(pkg.modules || {
      ota: false,
      staff: true,
      reports: true,
      cashHandover: true,
      expenses: true,
      invoices: true,
      policies: true,
      website: true,
      pos: false,
      inventory: false
    });
    setShowPackageModal(true);
  };

  const ensurePasswordHash = (pw?: string, fallback?: string): string => {
    const val = (pw || '').trim();
    if (!val) return fallback || sha256('password123');
    if (/^[a-f0-9]{64}$/i.test(val)) return val;
    return sha256(val);
  };

  const handleSavePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgFormName.trim()) {
      showToast('Please enter a package name.', 'warning');
      return;
    }
    if (Number(pkgFormPriceMonthly) < 0 || Number(pkgFormPriceYearly) < 0) {
      showToast('Package prices cannot be negative.', 'warning');
      return;
    }
    if (Number(pkgFormMaxRooms) < 1) {
      showToast('Max room capacity must be at least 1.', 'warning');
      return;
    }

    const roomLabel = pkgFormMaxRooms >= 999 ? 'Unlimited Rooms' : `Up to ${pkgFormMaxRooms} Rooms`;
    const newPkg: SaaSPackage = {
      id: editingPackageId || `pkg-${Date.now()}`,
      name: pkgFormName.trim(),
      tagline: pkgFormTagline.trim(),
      badge: pkgFormBadge.trim(),
      priceMonthly: Number(pkgFormPriceMonthly) || 0,
      priceYearly: Number(pkgFormPriceYearly) || 0,
      maxRooms: Number(pkgFormMaxRooms) || 10,
      roomTierLabel: roomLabel,
      description: pkgFormDesc.trim(),
      billingCycle: 'Both',
      modules: { ...pkgFormModules }
    };

    let updatedList: SaaSPackage[];
    if (editingPackageId) {
      updatedList = packagesList.map(p => p.id === editingPackageId ? newPkg : p);
    } else {
      updatedList = [...packagesList, newPkg];
    }

    if (onUpdatePackages) {
      onUpdatePackages(updatedList);
    }
    savePmsData({ packages: updatedList });
    syncAllToSupabase({ packages: updatedList }).catch(() => {});
    setShowPackageModal(false);
    setPkgToast(`✓ Package "${newPkg.name}" saved successfully!`);
    setTimeout(() => setPkgToast(null), 4000);
  };

  const handleDeletePackage = (pkgId: string, pkgName: string) => {
    if (!confirm(`Are you sure you want to delete package "${pkgName}"?`)) return;

    const assignedHotels = hotels.filter(h => h.packageId === pkgId);
    if (assignedHotels.length > 0) {
      if (!confirm(`Warning: ${assignedHotels.length} hotel properties are currently using "${pkgName}". Deleting this plan will reassign them to the default Starter plan. Proceed?`)) {
        return;
      }
      const remainingPkg = packagesList.find(p => p.id !== pkgId) || packagesList[0];
      if (onUpdateHotels) {
        const updatedHotels = hotels.map(h => {
          if (h.packageId === pkgId) {
            return {
              ...h,
              packageId: remainingPkg ? remainingPkg.id : undefined,
              subscriptionPrice: remainingPkg ? remainingPkg.priceMonthly : h.subscriptionPrice
            };
          }
          return h;
        });
        onUpdateHotels(updatedHotels);
      }
    }

    const updated = packagesList.filter(p => p.id !== pkgId);
    if (onUpdatePackages) {
      onUpdatePackages(updated);
    }
    savePmsData({ packages: updated });
    syncAllToSupabase({ packages: updated }).catch(() => {});
    setPkgToast(`✓ Package "${pkgName}" removed.`);
    setTimeout(() => setPkgToast(null), 4000);
  };

  const handleAssignPackageToHotel = (hotelId: string, pkg: SaaSPackage) => {
    if (!onUpdateHotels) return;
    const updated = hotels.map(h => {
      if (h.id === hotelId) {
        return {
          ...h,
          packageId: pkg.id,
          subscriptionPrice: pkg.priceMonthly
        };
      }
      return h;
    });
    onUpdateHotels(updated);
    setPkgToast(`✓ Successfully assigned package "${pkg.name}" to property.`);
    setTimeout(() => setPkgToast(null), 4000);
  };
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'All' | 'Assigned' | 'Unassigned' | 'Approved' | 'Pending'>('All');
  const [assignModalUser, setAssignModalUser] = useState<HotelAdminUser | null>(null);
  const [selectedAssignHotelId, setSelectedAssignHotelId] = useState<string>('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    username: '',
    password: '',
    email: '',
    mobile: '',
    hotelId: ''
  });
  const [editingUser, setEditingUser] = useState<HotelAdminUser | null>(null);
  const [editUserNewPassword, setEditUserNewPassword] = useState('');
  const [standaloneUsers, setStandaloneUsers] = useState<HotelAdminUser[]>([]);
  const updateStandaloneUsers = (updater: (prev: HotelAdminUser[]) => HotelAdminUser[]) => {
    setStandaloneUsers(prev => updater(prev));
  };
  const [userActionToast, setUserActionToast] = useState<string | null>(null);

  const getHotelStatus = (h: Hotel): 'Approved' | 'Pending' | 'Suspended' | 'Rejected' => {
    return h.status || 'Approved';
  };

  const handleUpdateStatus = (hotelId: string, newStatus: 'Approved' | 'Pending' | 'Rejected' | 'Suspended') => {
    const targetHotel = hotels.find(h => h.id === hotelId);
    const targetEmail = (targetHotel?.emailAddress || '').trim().toLowerCase();
    const targetUser = (targetHotel?.username || '').trim().toLowerCase();
    const targetOwnerUser = (targetHotel?.ownerUsername || '').trim().toLowerCase();

    const updated = hotels.map(h => {
      const isDirectMatch = h.id === hotelId;
      const isDuplicatePendingForSameOwner =
        newStatus === 'Approved' &&
        (h.status || 'Approved') === 'Pending' &&
        ((targetEmail && (h.emailAddress || '').trim().toLowerCase() === targetEmail) ||
          (targetUser && targetUser !== 'admin' && (h.username || '').trim().toLowerCase() === targetUser) ||
          (targetOwnerUser && targetOwnerUser !== 'owner' && (h.ownerUsername || '').trim().toLowerCase() === targetOwnerUser));

      if (isDirectMatch || isDuplicatePendingForSameOwner) {
        return { 
          ...h, 
          status: newStatus,
          subscriptionStatus: newStatus === 'Approved' ? ('Active' as const) : h.subscriptionStatus
        };
      }
      return h;
    });
    if (onUpdateHotels) {
      onUpdateHotels(updated);
    }
    if (newStatus === 'Approved') {
      const msg = `✓ Hotel "${targetHotel?.name || 'Property'}" has been approved and activated!`;
      showToast(msg, 'success', 'Property Approved');
      setUserActionToast(msg);
      setTimeout(() => setUserActionToast(null), 5000);
    } else if (newStatus === 'Suspended') {
      const msg = `Hotel "${targetHotel?.name || 'Property'}" has been suspended.`;
      showToast(msg, 'warning', 'Property Suspended');
      setUserActionToast(msg);
      setTimeout(() => setUserActionToast(null), 5000);
    } else if (newStatus === 'Rejected') {
      const msg = `Hotel "${targetHotel?.name || 'Property'}" registration was rejected.`;
      showToast(msg, 'error', 'Property Rejected');
      setUserActionToast(msg);
      setTimeout(() => setUserActionToast(null), 5000);
    }
  };

  const handleApproveAllPending = () => {
    const pendingHotels = hotels.filter(h => getHotelStatus(h) === 'Pending');
    if (pendingHotels.length === 0) {
      showToast('No pending hotel requests to approve.', 'info');
      return;
    }
    const updated = hotels.map(h => {
      if (getHotelStatus(h) === 'Pending') {
        return { ...h, status: 'Approved' as const, subscriptionStatus: 'Active' as const };
      }
      return h;
    });
    if (onUpdateHotels) {
      onUpdateHotels(updated);
    }
    const msg = `✓ All ${pendingHotels.length} pending hotel properties have been approved!`;
    showToast(msg, 'success', 'Bulk Approval Complete');
    setUserActionToast(msg);
    setTimeout(() => setUserActionToast(null), 5000);
  };

  const handleActivate = (hotelId: string) => {
    const updated = hotels.map(h => {
      if (h.id === hotelId) {
        return { ...h, status: 'Approved' as const, subscriptionStatus: 'Active' as const };
      }
      return h;
    });
    if (onUpdateHotels) {
      onUpdateHotels(updated);
    }
  };

  // Subscription Renewal Approval & Invoice Generation State
  const [renewalModalHotel, setRenewalModalHotel] = useState<Hotel | null>(null);
  const [renewalSelectedPkgId, setRenewalSelectedPkgId] = useState<string>('');
  const [renewalSelectedPkgName, setRenewalSelectedPkgName] = useState<string>('Monthly Pro Package');
  const [renewalSelectedPlan, setRenewalSelectedPlan] = useState<'Trial' | 'Monthly' | 'HalfYearly' | 'Yearly'>('Monthly');
  const [renewalBaseAmount, setRenewalBaseAmount] = useState<number>(1899);
  const [renewalIncludeGst, setRenewalIncludeGst] = useState<boolean>(true);
  const [renewalPaymentMethod, setRenewalPaymentMethod] = useState<string>('UPI');
  const [renewalTxnRef, setRenewalTxnRef] = useState<string>('');
  const [renewalNotes, setRenewalNotes] = useState<string>('Payment verified and approved by Super Admin');
  const [viewingSubscriptionInvoice, setViewingSubscriptionInvoice] = useState<SubscriptionInvoice | null>(null);

  const sampleSubscriptionInvoice: SubscriptionInvoice = {
    id: 'SUB-INV-SAMPLE-001',
    invoiceNumber: 'DS-SUB-2026-0101',
    hotelId: hotels[0]?.id || 'hotel-1792867091162',
    hotelName: hotels.find((h) => h.id === 'hotel-1792867091162')?.name || hotels[0]?.name || 'Hotel Test 1',
    ownerName: hotels[0]?.ownerName || 'Harshdeep Singh (Proprietor)',
    hotelAddress: hotels[0]?.address || 'MG Road, Hospitality District, India',
    hotelPhone: hotels[0]?.phoneNumber || '+91 9464165010',
    hotelEmail: hotels[0]?.emailAddress || 'harshdeepbca503@gmail.com',
    hotelGst: hotels[0]?.gstNumber || '21AABCH1234F1Z5',
    packageName: '1-Year Enterprise Growth Package',
    subscriptionPlan: 'Yearly',
    roomCapacityLabel: 'Up to 30 Rooms (Full Property Suite)',
    includedModules: [
      'Front Desk & Walk-In Reservations',
      'GST Tax Invoices & Billing Engine',
      'POS Restaurant & Food Billing',
      'Inventory Store & Purchase Ledger',
      'Housekeeping, Laundry & Audit Trail',
      'Staff Roles & Shift Roster Workspace',
      'Daily Financial & Occupancy Reports',
      'Direct Booking Website CMS',
    ],
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    baseAmount: 14000,
    gstRate: 18,
    gstAmount: 2520,
    cgstAmount: 1260,
    sgstAmount: 1260,
    totalAmount: 16520,
    paymentMethod: 'UPI / NEFT Bank Transfer',
    transactionReference: 'UTR62849102948',
    paymentStatus: 'Paid',
    approvedBy: 'Super Admin (DirectStay SaaS)',
    createdAt: new Date().toISOString().split('T')[0],
    notes: 'Annual Enterprise SaaS License verified & activated by Super Admin.',
  };

  const openRenewalModalForHotel = (hotel: Hotel) => {
    const req = hotel.renewalRequest;
    const plan = req?.requestedPlan || (hotel.subscriptionPlan === 'Trial' ? 'Monthly' : hotel.subscriptionPlan || 'Monthly');
    const matchedPkg = packagesList.find((p) => p.id === (req?.requestedPackageId || hotel.packageId));
    const defaultPrice =
      req?.requestedAmount !== undefined
        ? req.requestedAmount
        : matchedPkg
        ? plan === 'Yearly'
          ? matchedPkg.priceYearly
          : matchedPkg.priceMonthly
        : plan === 'Yearly'
        ? 14000
        : plan === 'HalfYearly'
        ? 7999
        : plan === 'Monthly'
        ? 1899
        : 0;
    const defaultPkgName =
      req?.requestedPackageName ||
      matchedPkg?.name ||
      (plan === 'Yearly'
        ? '1-Year Enterprise Package'
        : plan === 'HalfYearly'
        ? '6-Month Growth Package'
        : plan === 'Monthly'
        ? 'Monthly Pro Package'
        : 'Free Trial Package');

    setRenewalModalHotel(hotel);
    setRenewalSelectedPkgId(matchedPkg?.id || '');
    setRenewalSelectedPkgName(defaultPkgName);
    setRenewalSelectedPlan(plan);
    setRenewalBaseAmount(defaultPrice);
    setRenewalIncludeGst(true);
    setRenewalPaymentMethod(req?.paymentMethod || 'UPI');
    setRenewalTxnRef(req?.transactionReference || `UTR${Date.now().toString().slice(-8)}`);
    setRenewalNotes('Payment received & verified by Super Admin.');
  };

  const handleConfirmRenewalAndGenerateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewalModalHotel) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const currentEnd = renewalModalHotel.subscriptionEndDate
      ? new Date(renewalModalHotel.subscriptionEndDate)
      : new Date();
    const startBase = currentEnd.getTime() < Date.now() ? new Date() : currentEnd;
    const validFromStr = startBase.toISOString().split('T')[0];

    const endObj = new Date(startBase);
    if (renewalSelectedPlan === 'Trial') endObj.setDate(endObj.getDate() + 7);
    else if (renewalSelectedPlan === 'Monthly') endObj.setDate(endObj.getDate() + 30);
    else if (renewalSelectedPlan === 'HalfYearly') endObj.setDate(endObj.getDate() + 180);
    else endObj.setDate(endObj.getDate() + 365);
    const validUntilStr = endObj.toISOString().split('T')[0];

    const matchedPkg = packagesList.find((p) => p.id === renewalSelectedPkgId);
    const gstRate = renewalIncludeGst ? 5 : 0;
    const baseAmt = Math.max(0, Number(renewalBaseAmount) || 0);
    const gstAmt = Math.round((baseAmt * gstRate) / 100);
    const cgstAmt = Number(((baseAmt * (gstRate / 2)) / 100).toFixed(2));
    const sgstAmt = Number(((baseAmt * (gstRate / 2)) / 100).toFixed(2));
    const totalAmt = baseAmt + gstAmt;

    const includedModules: string[] = [];
    if (matchedPkg?.modules) {
      if (matchedPkg.modules.invoices) includedModules.push('GST Invoices & Billing');
      if (matchedPkg.modules.reports) includedModules.push('Daily & Financial Reports');
      if (matchedPkg.modules.expenses) includedModules.push('Expense Accounting');
      if (matchedPkg.modules.cashHandover) includedModules.push('Cash Handover Vault');
      if (matchedPkg.modules.staff) includedModules.push('Staff Roster & Roles');
      if (matchedPkg.modules.pos) includedModules.push('POS Restaurant Billing');
      if (matchedPkg.modules.inventory) includedModules.push('Inventory Store');
      if (matchedPkg.modules.ota) includedModules.push('OTA Channel Manager');
      if (matchedPkg.modules.website) includedModules.push('Direct Booking Website');
    } else {
      includedModules.push(
        'Front Desk & Reservations',
        'GST Tax Invoices & Billing Engine',
        'Housekeeping & Room Verification',
        'POS Restaurant & Inventory Store',
        'Financial & Occupancy Reports',
        'Staff Roles & Security Audit Logs'
      );
    }

    const newSubInvoice: SubscriptionInvoice = {
      id: `SUB-INV-${Date.now()}`,
      invoiceNumber: `DS-INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      hotelId: renewalModalHotel.id,
      hotelName: renewalModalHotel.name,
      ownerName: renewalModalHotel.ownerName || 'Property Owner',
      hotelAddress: renewalModalHotel.address || '',
      hotelPhone: renewalModalHotel.phoneNumber || '',
      hotelEmail: renewalModalHotel.emailAddress || '',
      hotelGst: renewalModalHotel.gstNumber || '',
      packageId: renewalSelectedPkgId || undefined,
      packageName: renewalSelectedPkgName,
      subscriptionPlan: renewalSelectedPlan,
      roomCapacityLabel: matchedPkg
        ? `Up to ${matchedPkg.maxRooms} Rooms`
        : `${renewalModalHotel.roomTierLimit || '1-10'} Rooms Tier`,
      includedModules,
      validFrom: validFromStr,
      validUntil: validUntilStr,
      baseAmount: baseAmt,
      gstRate,
      gstAmount: gstAmt,
      cgstAmount: cgstAmt,
      sgstAmount: sgstAmt,
      totalAmount: totalAmt,
      paymentMethod: renewalPaymentMethod,
      transactionReference: renewalTxnRef.trim() || 'VERIFIED-BY-SUPERADMIN',
      paymentStatus: 'Paid',
      approvedBy: 'Super Admin',
      createdAt: todayStr,
      notes: renewalNotes.trim(),
    };

    const updatedHotels = hotels.map((h) => {
      if (h.id === renewalModalHotel.id) {
        const existingInvoices = Array.isArray(h.subscriptionInvoices) ? h.subscriptionInvoices : [];
        return {
          ...h,
          status: 'Approved' as const,
          subscriptionStatus: 'Active' as const,
          packageId: renewalSelectedPkgId || h.packageId,
          subscriptionPlan: renewalSelectedPlan,
          subscriptionPrice: baseAmt,
          subscriptionEndDate: validUntilStr,
          renewalRequest: h.renewalRequest
            ? {
                ...h.renewalRequest,
                status: 'Approved' as const,
                approvedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
                approvedBy: 'Super Admin',
              }
            : undefined,
          subscriptionInvoices: [newSubInvoice, ...existingInvoices],
        };
      }
      return h;
    });

    if (onUpdateHotels) {
      onUpdateHotels(updatedHotels);
    }

    const msg = `✓ Renewal approved for "${renewalModalHotel.name}" (${renewalSelectedPkgName}) & Invoice #${newSubInvoice.invoiceNumber} generated!`;
    showToast(msg, 'success', 'Renewal Approved & Invoice Generated');
    setUserActionToast(msg);
    setTimeout(() => setUserActionToast(null), 5000);

    setRenewalModalHotel(null);
    setViewingSubscriptionInvoice(newSubInvoice);
  };

  const handleRejectRenewalRequest = (hotelId: string) => {
    const target = hotels.find((h) => h.id === hotelId);
    if (!target || !target.renewalRequest) return;
    const updatedHotels = hotels.map((h) => {
      if (h.id === hotelId && h.renewalRequest) {
        return {
          ...h,
          renewalRequest: {
            ...h.renewalRequest,
            status: 'Rejected' as const,
            approvedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
            approvedBy: 'Super Admin',
          },
        };
      }
      return h;
    });
    if (onUpdateHotels) {
      onUpdateHotels(updatedHotels);
    }
    const msg = `Renewal request for "${target.name}" marked as Rejected.`;
    showToast(msg, 'warning', 'Renewal Request Rejected');
    setUserActionToast(msg);
    setTimeout(() => setUserActionToast(null), 5000);
  };

  const handleRenewMembership = (hotelId: string) => {
    const target = hotels.find((h) => h.id === hotelId);
    if (target) {
      openRenewalModalForHotel(target);
    }
  };

  const handleChangePackage = (hotelId: string, newPlan: 'Trial' | 'Monthly' | 'HalfYearly' | 'Yearly') => {
    const updated = hotels.map(h => {
      if (h.id === hotelId) {
        let planPrice = 0;
        if (newPlan === 'Monthly') planPrice = 1899;
        if (newPlan === 'HalfYearly') planPrice = 7999;
        if (newPlan === 'Yearly') planPrice = 14000;

        const d = new Date();
        if (newPlan === 'Trial') d.setDate(d.getDate() + 7);
        else if (newPlan === 'Monthly') d.setDate(d.getDate() + 30);
        else if (newPlan === 'HalfYearly') d.setDate(d.getDate() + 180);
        else if (newPlan === 'Yearly') d.setDate(d.getDate() + 365);

        return {
          ...h,
          subscriptionPlan: newPlan,
          subscriptionPrice: planPrice,
          subscriptionEndDate: d.toISOString().split('T')[0],
          subscriptionStatus: 'Active' as const
        };
      }
      return h;
    });
    if (onUpdateHotels) {
      onUpdateHotels(updated);
    }
    setPackageChangingHotel(null);
  };

  const handleSaveProfile = (updatedHotel: Hotel) => {
    const updated = hotels.map(h => {
      if (h.id === updatedHotel.id) {
        const newPass = updatedHotel.password
          ? ensurePasswordHash(updatedHotel.password, h.password)
          : h.password;
        const newOwnerPass = updatedHotel.ownerPassword
          ? ensurePasswordHash(updatedHotel.ownerPassword, h.ownerPassword)
          : updatedHotel.password
          ? newPass
          : h.ownerPassword;
        return {
          ...updatedHotel,
          password: newPass,
          ownerPassword: newOwnerPass
        };
      }
      return h;
    });
    if (onUpdateHotels) {
      onUpdateHotels(updated);
    }
    setEditingHotel(null);
  };
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelAddress, setNewHotelAddress] = useState('');
  const [newHotelPhone, setNewHotelPhone] = useState('');
  const [newHotelEmail, setNewHotelEmail] = useState('');
  const [newHotelGst, setNewHotelGst] = useState('');
  const [newHotelWebsite, setNewHotelWebsite] = useState('');
  const [newHotelLogo, setNewHotelLogo] = useState('');
  const [newHotelUsername, setNewHotelUsername] = useState('');
  const [newHotelPassword, setNewHotelPassword] = useState('');
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [stepErrors, setStepErrors] = useState<string | null>(null);
  const [roomTier, setRoomTier] = useState<'1-10' | '10-20' | '20-30' | '30-50'>('1-10');
  const [selectedPlan, setSelectedPlan] = useState<'Trial' | 'Monthly' | 'HalfYearly' | 'Yearly'>('Trial');
  const [selectedTemplate, setSelectedTemplate] = useState<'Boutique' | 'Luxury' | 'Budget'>('Boutique');
  const [dragActive, setDragActive] = useState(false);

  // Website dynamic config edit state (merges defaults so every section/card is always populated)
  const buildMergedWebsiteConfig = (cfg: SystemWebsiteConfig): SystemWebsiteConfig => ({
    ...INITIAL_SYSTEM_WEBSITE,
    ...cfg,
    whatsappNumber: cfg.whatsappNumber || cfg.supportPhone || INITIAL_SYSTEM_WEBSITE.whatsappNumber,
    heroTrustBadges:
      Array.isArray(cfg.heroTrustBadges) && cfg.heroTrustBadges.length > 0
        ? cfg.heroTrustBadges
        : INITIAL_SYSTEM_WEBSITE.heroTrustBadges,
    heroBottomPillars:
      Array.isArray(cfg.heroBottomPillars) && cfg.heroBottomPillars.length > 0
        ? cfg.heroBottomPillars
        : INITIAL_SYSTEM_WEBSITE.heroBottomPillars,
    featureCards:
      Array.isArray(cfg.featureCards) && cfg.featureCards.length > 0
        ? cfg.featureCards
        : INITIAL_SYSTEM_WEBSITE.featureCards,
    pricingCards:
      Array.isArray(cfg.pricingCards) && cfg.pricingCards.length > 0
        ? cfg.pricingCards
        : INITIAL_SYSTEM_WEBSITE.pricingCards,
    visionPillars:
      Array.isArray(cfg.visionPillars) && cfg.visionPillars.length > 0
        ? cfg.visionPillars
        : INITIAL_SYSTEM_WEBSITE.visionPillars,
    testimonials: Array.isArray(cfg.testimonials)
      ? cfg.testimonials
      : INITIAL_SYSTEM_WEBSITE.testimonials || [],
    blogHeading: cfg.blogHeading || INITIAL_SYSTEM_WEBSITE.blogHeading,
    blogSubtitle: cfg.blogSubtitle || INITIAL_SYSTEM_WEBSITE.blogSubtitle,
    blogs: Array.isArray(cfg.blogs)
      ? cfg.blogs
      : INITIAL_SYSTEM_WEBSITE.blogs || [],
    customSections: Array.isArray(cfg.customSections) ? cfg.customSections : []
  });

  const [cmsConfig, setCmsConfig] = useState<SystemWebsiteConfig>(() =>
    buildMergedWebsiteConfig(systemWebsite)
  );

  React.useEffect(() => {
    setCmsConfig(buildMergedWebsiteConfig(systemWebsite));
  }, [systemWebsite]);

  const updateCmsField = <K extends keyof SystemWebsiteConfig>(
    key: K,
    value: SystemWebsiteConfig[K]
  ) => {
    setCmsConfig((prev) => ({ ...prev, [key]: value }));
  };

  // Blog Management State (SuperAdmin -> Home Page Blog Section)
  const blogsList = cmsConfig.blogs || INITIAL_SYSTEM_WEBSITE.blogs || [];
  const [blogSearch, setBlogSearch] = useState('');
  const [showBlogModal, setShowBlogModal] = useState(false);
  const [editingBlogId, setEditingBlogId] = useState<string | null>(null);
  const [blogTitle, setBlogTitle] = useState('');
  const [blogCategory, setBlogCategory] = useState('Hospitality & PMS');
  const [blogAuthor, setBlogAuthor] = useState('DirectStay Editorial Desk');
  const [blogPublishedAt, setBlogPublishedAt] = useState(() => new Date().toISOString().split('T')[0]);
  const [blogReadTime, setBlogReadTime] = useState('4 min read');
  const [blogImageUrl, setBlogImageUrl] = useState('');
  const [blogSummary, setBlogSummary] = useState('');
  const [blogContent, setBlogContent] = useState('');
  const [blogPublished, setBlogPublished] = useState(true);
  const [viewingBlog, setViewingBlog] = useState<WebsiteBlogPost | null>(null);

  const persistUpdatedBlogs = (nextBlogs: WebsiteBlogPost[], extraFields?: Partial<SystemWebsiteConfig>) => {
    const nextConfig: SystemWebsiteConfig = {
      ...cmsConfig,
      ...extraFields,
      blogs: nextBlogs
    };
    setCmsConfig(nextConfig);
    onUpdateSystemWebsite(nextConfig);
    savePmsData({ systemWebsite: nextConfig });
    syncAllToSupabase({ systemWebsite: nextConfig }).catch(() => {});
  };

  const handleOpenAddBlog = () => {
    setEditingBlogId(null);
    setBlogTitle('');
    setBlogCategory('Hospitality & PMS');
    setBlogAuthor('DirectStay Editorial Desk');
    setBlogPublishedAt(new Date().toISOString().split('T')[0]);
    setBlogReadTime('4 min read');
    setBlogImageUrl('');
    setBlogSummary('');
    setBlogContent('');
    setBlogPublished(true);
    setShowBlogModal(true);
  };

  const handleOpenEditBlog = (b: WebsiteBlogPost) => {
    setEditingBlogId(b.id);
    setBlogTitle(b.title);
    setBlogCategory(b.category || 'Hospitality & PMS');
    setBlogAuthor(b.author || 'DirectStay Editorial Desk');
    setBlogPublishedAt(b.publishedAt || new Date().toISOString().split('T')[0]);
    setBlogReadTime(b.readTime || '4 min read');
    setBlogImageUrl(b.imageUrl || '');
    setBlogSummary(b.summary || '');
    setBlogContent(b.content || '');
    setBlogPublished(b.published !== false);
    setShowBlogModal(true);
  };

  const handleSaveBlog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blogTitle.trim()) {
      showToast('Blog Title is required', 'warning');
      return;
    }
    const slug = blogTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const summaryText = blogSummary.trim() || blogContent.trim().slice(0, 160);
    let nextBlogs: WebsiteBlogPost[];
    if (editingBlogId) {
      nextBlogs = blogsList.map((b) =>
        b.id === editingBlogId
          ? {
              ...b,
              title: blogTitle.trim(),
              slug,
              category: blogCategory.trim() || 'Hospitality & PMS',
              author: blogAuthor.trim() || 'DirectStay Editorial Desk',
              publishedAt: blogPublishedAt || new Date().toISOString().split('T')[0],
              readTime: blogReadTime.trim() || '4 min read',
              imageUrl: blogImageUrl.trim(),
              summary: summaryText,
              content: blogContent.trim() || summaryText,
              published: blogPublished
            }
          : b
      );
      showToast(`Blog "${blogTitle.trim()}" updated and published to Home Page!`, 'success');
    } else {
      const newPost: WebsiteBlogPost = {
        id: `blog-${Date.now()}`,
        title: blogTitle.trim(),
        slug,
        category: blogCategory.trim() || 'Hospitality & PMS',
        author: blogAuthor.trim() || 'DirectStay Editorial Desk',
        publishedAt: blogPublishedAt || new Date().toISOString().split('T')[0],
        readTime: blogReadTime.trim() || '4 min read',
        imageUrl:
          blogImageUrl.trim() ||
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
        summary: summaryText,
        content: blogContent.trim() || summaryText,
        published: blogPublished
      };
      nextBlogs = [newPost, ...blogsList];
      showToast(`New blog "${blogTitle.trim()}" added to Home Page!`, 'success');
    }
    persistUpdatedBlogs(nextBlogs);
    setShowBlogModal(false);
  };

  const handleDeleteBlog = (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete blog post "${title}"?`)) return;
    const nextBlogs = blogsList.filter((b) => b.id !== id);
    persistUpdatedBlogs(nextBlogs);
    showToast(`Deleted blog post "${title}".`, 'info');
  };

  const handleTogglePublishBlog = (id: string) => {
    const nextBlogs = blogsList.map((b) => (b.id === id ? { ...b, published: !b.published } : b));
    persistUpdatedBlogs(nextBlogs);
    showToast('Updated blog publish status on Home Page.', 'success');
  };

  const handleBlogImageFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setBlogImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // For adding custom testimonials
  const [newAuthor, setNewAuthor] = useState('');
  const [newHotelNameTestimonial, setNewHotelNameTestimonial] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newRating, setNewRating] = useState(5);

  const [saveSuccess, setSaveSuccess] = useState(false);

  // SaaS calculations across all tenants
  const totalHotels = hotels.length;
  const totalRoomsCount = rawRooms.length;
  const totalBookingsCount = rawBookings.length;
  
  // Aggregate revenue
  const totalRevenue = rawInvoices
    .filter(inv => inv.isPaid)
    .reduce((sum, inv) => sum + inv.finalAmount, 0);

  // SaaS Operations Dashboard Metrics & Calculations
  const totalHotelsCount = hotels.length;
  const activeHotelsCount = hotels.filter(h => h.subscriptionStatus === 'Active' && getHotelStatus(h) === 'Approved').length;
  const pendingApprovalsCount = hotels.filter(h => getHotelStatus(h) === 'Pending').length;
  const freeTrialCount = hotels.filter(h => h.subscriptionPlan === 'Trial').length;

  const getDaysLeft = (endDateStr?: string) => {
    if (!endDateStr) return -1;
    const end = new Date(endDateStr);
    const today = new Date();
    end.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const membershipExpiringCount = hotels.filter(h => {
    if (h.subscriptionStatus !== 'Active') return false;
    const left = getDaysLeft(h.subscriptionEndDate);
    return left >= 0 && left <= 7;
  }).length;

  const expiredCount = hotels.filter(h => {
    return h.subscriptionStatus === 'Expired' || (h.subscriptionEndDate && getDaysLeft(h.subscriptionEndDate) < 0);
  }).length;

  const monthlyRevenueSum = hotels.reduce((sum, h) => {
    if (h.subscriptionStatus !== 'Active' || h.status !== 'Approved') return sum;
    if (h.subscriptionPlan === 'Monthly') return sum + 1899;
    if (h.subscriptionPlan === 'HalfYearly') return sum + Math.round(7999 / 6);
    if (h.subscriptionPlan === 'Yearly') return sum + Math.round(14000 / 12);
    return sum;
  }, 0);

  const totalRevenueSum = hotels.reduce((sum, h) => {
    if (h.subscriptionPlan === 'Trial') return sum;
    return sum + (h.subscriptionPrice || 0);
  }, 0);

  const totalPackagesSold = hotels.filter(h => h.subscriptionPlan !== 'Trial').length;

  const distTrial = hotels.filter(h => h.subscriptionPlan === 'Trial').length;
  const distMonthly = hotels.filter(h => h.subscriptionPlan === 'Monthly').length;
  const distHalfYearly = hotels.filter(h => h.subscriptionPlan === 'HalfYearly').length;
  const distYearly = hotels.filter(h => h.subscriptionPlan === 'Yearly').length;

  const allActivities = hotels.map((h) => {
    const status = getHotelStatus(h);
    const type = (
      status === 'Pending'
        ? 'Registration'
        : status === 'Suspended' || status === 'Rejected' || h.subscriptionStatus === 'Expired'
        ? 'Suspension'
        : h.subscriptionPlan !== 'Trial'
        ? 'Upgrade'
        : 'Approval'
    ) as 'Registration' | 'Approval' | 'Upgrade' | 'Renewal' | 'Suspension';
    return {
      id: `act-${h.id}`,
      hotelName: h.name,
      type,
      description:
        status === 'Pending'
          ? `Registered for ${h.subscriptionPlan} Plan (Room Cap: ${h.roomTierLimit || '1-10'})`
          : status === 'Suspended' || status === 'Rejected'
          ? `Property status set to ${status}`
          : `Active on ${h.subscriptionPlan} package (Room Cap: ${h.roomTierLimit || '1-10'})`,
      date: h.trialStartDate || new Date().toISOString().split('T')[0],
      time: '12:00',
      amount: h.subscriptionPrice ? `₹${Number(h.subscriptionPrice || 0).toLocaleString('en-IN')}` : undefined
    };
  });

  const filteredActivities = activityFilter === 'All' 
    ? allActivities 
    : allActivities.filter(act => act.type === activityFilter);

  const getHotelStats = (hotelId: string) => {
    const rooms = rawRooms.filter(r => r.hotelId === hotelId);
    const bookings = rawBookings.filter(b => b.hotelId === hotelId);
    const invoices = rawInvoices.filter(i => i.hotelId === hotelId && i.isPaid);

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'Occupied').length;
    const activeBookings = bookings.filter(b => b.status === 'Confirmed').length;
    const revenue = invoices.reduce((sum, inv) => sum + inv.finalAmount, 0);
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    return { totalRooms, occupiedRooms, activeBookings, revenue, occupancyRate };
  };

  const handleAddHotelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHotelName.trim()) return;

    const newId = `hotel-${Date.now()}`;
    const defaultLogo = newHotelLogo.trim() || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=150&auto=format&fit=crop&q=60';
    
    // Calculate Plan prices
    let planPrice = 0;
    if (selectedPlan === 'Monthly') planPrice = 1899;
    if (selectedPlan === 'HalfYearly') planPrice = 7999;
    if (selectedPlan === 'Yearly') planPrice = 14000;

    const calculateEndDate = (plan: typeof selectedPlan) => {
      const d = new Date();
      if (plan === 'Trial') d.setDate(d.getDate() + 7);
      else if (plan === 'Monthly') d.setDate(d.getDate() + 30);
      else if (plan === 'HalfYearly') d.setDate(d.getDate() + 180);
      else if (plan === 'Yearly') d.setDate(d.getDate() + 365);
      return d.toISOString().split('T')[0];
    };

    const adminUser = newHotelUsername.trim() || 'admin';
    const adminPass = newHotelPassword.trim() || 'password';

    const newHotel: Hotel = {
      id: newId,
      name: newHotelName.trim(),
      address: newHotelAddress.trim() || 'Main Road',
      phoneNumber: newHotelPhone.trim() || '+91 98765 43210',
      emailAddress: newHotelEmail.trim() || `contact@${newHotelName.toLowerCase().replace(/\s+/g, '')}.com`,
      gstNumber: newHotelGst.trim() || '',
      website: newHotelWebsite.trim() || `www.${newHotelName.toLowerCase().replace(/\s+/g, '')}.com`,
      logoUrl: defaultLogo,
      status: 'Approved',
      subscriptionPlan: selectedPlan,
      subscriptionStatus: 'Active',
      subscriptionPrice: planPrice,
      trialStartDate: new Date().toISOString().split('T')[0],
      subscriptionEndDate: calculateEndDate(selectedPlan),
      roomTierLimit: roomTier,
      username: adminUser,
      password: adminPass,
      ownerUsername: `${adminUser}_owner`,
      ownerPassword: adminPass
    };

    onAddHotel(newHotel, selectedTemplate);
    
    // Clear form & close
    setNewHotelName('');
    setNewHotelAddress('');
    setNewHotelPhone('');
    setNewHotelEmail('');
    setNewHotelGst('');
    setNewHotelWebsite('');
    setNewHotelLogo('');
    setNewHotelUsername('');
    setNewHotelPassword('');
    setRoomTier('1-10');
    setSelectedPlan('Trial');
    setOnboardingStep(1);
    setStepErrors(null);
    setShowAddModal(false);
  };

  const handleLogoUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setNewHotelLogo(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLogoUpload(e.dataTransfer.files[0]);
    }
  };

  const handleImpersonate = (hotelId: string) => {
    onSelectHotel(hotelId);
    try {
      sessionStorage.setItem('pms_hotel_id', hotelId);
      localStorage.setItem('pms_hotel_id', hotelId);
      localStorage.setItem('pms_role', 'SuperAdmin');
      const token = sessionStorage.getItem('pms_session_token') || localStorage.getItem('pms_session_token');
      if (token) {
        localStorage.setItem('pms_session_token', token);
        localStorage.setItem('pms_auth_token', token);
        localStorage.setItem('pms_authenticated', 'true');
      }
    } catch {}

    window.open(`/admin/dashboard?hotelId=${encodeURIComponent(hotelId)}&asAdmin=true`, '_blank');
  };

  return (
    <div className="space-y-6" id="superadmin-workspace">
      {/* SaaS Welcome Panel */}
      <div className="bg-gradient-to-r from-luxury-brown-900 via-luxury-brown-950 to-[#140D09] text-white rounded-2xl p-6 md:p-7 shadow-lg relative overflow-hidden border border-luxury-gold-500/20 animate-fade-in">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-10 w-80 h-80 bg-luxury-gold-500 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-luxury-gold-500/15 text-luxury-gold-300 border border-luxury-gold-500/25 text-[10px] font-mono uppercase tracking-[0.2em]">
              <Sparkles className="w-3.5 h-3.5 text-luxury-gold-400" /> Imperial SaaS Master Console
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold tracking-wide text-[#263449]">
              Multi-Hotel Enterprise Governance
            </h1>
            <p className="text-luxury-brown-200 text-xs md:text-sm max-w-2xl leading-relaxed">
              Onboard boutique hotel properties, configure subscription package permissions, audit tenant credentials, and manage the public DirectStay marketing platform.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setViewingSubscriptionInvoice(sampleSubscriptionInvoice)}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-luxury-gold-300 border border-luxury-gold-500/40 font-bold px-4 py-2.5 rounded-xl transition-all text-xs cursor-pointer"
            >
              <FileText className="w-4 h-4 text-luxury-gold-400" />
              <span>View Sample Renewal Invoice</span>
            </button>
            {pendingApprovalsCount > 0 && (
              <button
                onClick={() => { setActiveSubTab('hotels'); setHotelFilter('Pending'); }}
                className="inline-flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 font-bold px-4 py-2.5 rounded-xl transition-all text-xs cursor-pointer"
              >
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>{pendingApprovalsCount} Pending Approval{pendingApprovalsCount > 1 ? 's' : ''}</span>
              </button>
            )}
            <button
              onClick={() => { setShowAddModal(true); setOnboardingStep(1); }}
              className="inline-flex items-center gap-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold px-5 py-2.5 rounded-xl shadow-md transition-all duration-300 text-xs uppercase tracking-wider cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Onboard New Hotel
            </button>
          </div>
        </div>
      </div>



      {/* Sub tabs switcher */}
      <div className="bg-white border border-luxury-brown-100 rounded-2xl p-1.5 shadow-2xs grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
        {[
          { key: 'dashboard', id: 'subtab-dashboard', label: 'SaaS Overview', badge: null },
          { key: 'hotels', id: 'subtab-hotels', label: 'Hotel Properties', badge: hotels.length },
          { key: 'packages', id: 'subtab-packages', label: 'Package Plans', badge: packagesList.length },
          { key: 'users', id: 'subtab-users', label: 'Admin & Staff Users', badge: hotels.length + standaloneUsers.length },
          { key: 'leads', id: 'subtab-leads', label: 'Sales & Leads CRM', badge: mergedSalesLeads.length },
          { key: 'blogs', id: 'subtab-blogs', label: 'Blog Management', badge: blogsList.length },
          { key: 'website', id: 'subtab-website', label: 'Website CMS', badge: null },
          { key: 'pages', id: 'subtab-pages', label: 'Custom Pages', badge: customPagesList.length },
        ].map((tab) => {
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key as any)}
              id={tab.id}
              className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-sans font-bold text-[11px] sm:text-xs transition-all truncate sm:whitespace-nowrap cursor-pointer flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 min-w-0 ${
                isActive
                  ? 'bg-luxury-brown-900 text-white shadow-xs'
                  : 'text-luxury-brown-600 bg-slate-50 sm:bg-transparent hover:bg-luxury-beige-50 hover:text-luxury-brown-950'
              }`}
            >
              <span className="truncate">{tab.label}</span>
              {tab.badge !== null && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                  isActive ? 'bg-luxury-gold-500 text-luxury-brown-950' : 'bg-luxury-beige-100 text-luxury-brown-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Package Toast Notification */}
      {pkgToast && (
        <div className="bg-emerald-900 text-emerald-100 px-4 py-3 rounded-xl shadow-lg border border-emerald-500/30 flex items-center justify-between text-xs font-semibold animate-fade-in my-2">
          <span>{pkgToast}</span>
          <button onClick={() => setPkgToast(null)} className="text-emerald-300 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Package Management Sub-Tab View */}
      {activeSubTab === 'packages' && (
        <div className="space-y-6 animate-fade-in pt-2">
          {/* Top Header Card */}
          <div className="bg-gradient-to-br from-luxury-brown-900 via-luxury-brown-950 to-black text-white p-6 rounded-2xl border border-luxury-gold-500/20 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-luxury-gold-500/20 text-luxury-gold-300 border border-luxury-gold-500/20 text-[10px] font-mono uppercase font-bold tracking-wider">
                <Package className="w-3.5 h-3.5" /> Package & Feature Module Control Engine
              </div>
              <h2 className="text-2xl font-serif font-bold text-white">SaaS Subscription Packages</h2>
              <p className="text-xs text-luxury-brown-200 max-w-2xl">
                Define pricing tiers, maximum room inventory limits, and toggle module permissions (e.g., OTA Channel Sync and Staff Management are restricted based on tier).
              </p>
            </div>

            <button
              onClick={handleOpenAddPackage}
              className="inline-flex items-center gap-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold px-4 py-2.5 rounded-xl shadow-md transition-all text-xs cursor-pointer whitespace-nowrap hover:scale-102"
            >
              <Plus className="w-4 h-4" /> Create New Package Plan
            </button>
          </div>

          {/* Package Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {packagesList.map((pkg) => {
              const enrolledHotels = hotels.filter(h => h.packageId === pkg.id);
              return (
                <div 
                  key={pkg.id} 
                  className="bg-white rounded-2xl border border-luxury-brown-100 shadow-md hover:shadow-xl transition-all flex flex-col overflow-hidden relative group"
                >
                  {/* Top Accent bar */}
                  <div className="h-2 bg-gradient-to-r from-luxury-brown-800 via-luxury-gold-500 to-luxury-brown-900" />
                  
                  <div className="p-6 flex-1 space-y-5">
                    {/* Header */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-luxury-gold-500/10 text-luxury-brown-900 border border-luxury-gold-500/30 uppercase tracking-wider mb-1">
                          {pkg.badge || 'Plan'}
                        </span>
                        <h3 className="text-xl font-serif font-bold text-luxury-brown-950">{pkg.name}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-serif font-extrabold text-luxury-brown-950">₹{Number(pkg.priceMonthly || 0).toLocaleString('en-IN')}</span>
                        <span className="block text-[10px] font-mono text-luxury-brown-500">/ month</span>
                        <span className="text-[10px] font-mono text-emerald-700 block font-semibold mt-0.5">₹{Number(pkg.priceYearly || 0).toLocaleString('en-IN')}/yr</span>
                      </div>
                    </div>

                    <p className="text-xs text-luxury-brown-600 line-clamp-2 italic">
                      "{pkg.tagline || pkg.description || 'Standard subscription tier for hospitality clients.'}"
                    </p>

                    {/* Capacity & Enrolled Pill */}
                    <div className="flex items-center justify-between gap-2 bg-luxury-beige-50 p-2.5 rounded-xl border border-luxury-brown-100 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-luxury-brown-900">
                        <Building className="w-4 h-4 text-luxury-gold-600" />
                        <span>Room Limit: <strong className="text-luxury-brown-950">{pkg.maxRooms >= 999 ? 'Unlimited' : `${pkg.maxRooms} Rooms`}</strong></span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-luxury-brown-900 text-luxury-gold-300 font-mono text-[10px] font-bold">
                        {enrolledHotels.length} Hotels
                      </span>
                    </div>

                    {/* Modules Permission Grid */}
                    <div className="space-y-2 border-t border-luxury-brown-100 pt-4">
                      <span className="text-[10px] font-mono uppercase font-bold text-luxury-brown-400 tracking-wider block">Module Access Matrix</span>
                      
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        {/* OTA Channel Sync */}
                        <div className={`p-2 rounded-lg border flex items-center justify-between ${pkg.modules?.ota ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-75'}`}>
                          <span className="font-medium text-[11px] truncate">🔌 OTA Manager</span>
                          {pkg.modules?.ota ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        </div>

                        {/* Staff Management */}
                        <div className={`p-2 rounded-lg border flex items-center justify-between ${pkg.modules?.staff ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-75'}`}>
                          <span className="font-medium text-[11px] truncate">👥 Staff Roster</span>
                          {pkg.modules?.staff ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        </div>

                        {/* Financial Reports */}
                        <div className={`p-2 rounded-lg border flex items-center justify-between ${pkg.modules?.reports ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-75'}`}>
                          <span className="font-medium text-[11px] truncate">📊 Reports</span>
                          {pkg.modules?.reports ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                        </div>

                        {/* Cash Handover */}
                        <div className={`p-2 rounded-lg border flex items-center justify-between ${pkg.modules?.cashHandover ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-75'}`}>
                          <span className="font-medium text-[11px] truncate">💸 Cash Vault</span>
                          {pkg.modules?.cashHandover ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                        </div>

                        {/* Expense Accounting */}
                        <div className={`p-2 rounded-lg border flex items-center justify-between ${pkg.modules?.expenses ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-75'}`}>
                          <span className="font-medium text-[11px] truncate">💰 Expenses</span>
                          {pkg.modules?.expenses ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                        </div>

                        {/* GST Invoices */}
                        <div className={`p-2 rounded-lg border flex items-center justify-between ${pkg.modules?.invoices ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-75'}`}>
                          <span className="font-medium text-[11px] truncate">🧾 GST Invoices</span>
                          {pkg.modules?.invoices ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                        </div>

                        {/* House Policies */}
                        <div className={`p-2 rounded-lg border flex items-center justify-between ${pkg.modules?.policies ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-75'}`}>
                          <span className="font-medium text-[11px] truncate">📋 Policies</span>
                          {pkg.modules?.policies ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                        </div>

                        {/* Direct Website */}
                        <div className={`p-2 rounded-lg border flex items-center justify-between ${pkg.modules?.website ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-75'}`}>
                          <span className="font-medium text-[11px] truncate">🌐 Booking Site</span>
                          {pkg.modules?.website ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                        </div>

                        {/* POS Billing */}
                        <div className={`p-2 rounded-lg border flex items-center justify-between ${pkg.modules?.pos ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-75'}`}>
                          <span className="font-medium text-[11px] truncate">🍽️ POS Terminal</span>
                          {pkg.modules?.pos ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        </div>

                        {/* Inventory Manager */}
                        <div className={`p-2 rounded-lg border flex items-center justify-between ${pkg.modules?.inventory ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-75'}`}>
                          <span className="font-medium text-[11px] truncate">🛒 Stock Inventory</span>
                          {pkg.modules?.inventory ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="bg-luxury-beige-50/80 p-4 border-t border-luxury-brown-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenEditPackage(pkg)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-luxury-brown-200 text-luxury-brown-800 text-xs font-semibold hover:bg-luxury-brown-900 hover:text-white transition-all cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit Package
                    </button>

                    <button
                      onClick={() => setAssignPkgModal(pkg)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-luxury-gold-500 text-luxury-brown-950 text-xs font-bold hover:bg-luxury-gold-400 transition-all cursor-pointer"
                    >
                      <Building className="w-3.5 h-3.5" /> Assign Properties
                    </button>

                    <button
                      onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                      title="Delete Package"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSubTab === 'hotels' && (() => {
        const getTrialEndDate = (startDate?: string) => {
          if (!startDate) return 'N/A';
          const d = new Date(startDate);
          d.setDate(d.getDate() + 7);
          return d.toISOString().split('T')[0];
        };

        const countAll = hotels.length;
        const countPending = hotels.filter(h => getHotelStatus(h) === 'Pending').length;
        const countApproved = hotels.filter(h => getHotelStatus(h) === 'Approved').length;
        const countTrial = hotels.filter(h => h.subscriptionPlan === 'Trial').length;
        const countExpiring = hotels.filter(h => {
          if (h.subscriptionStatus !== 'Active') return false;
          const left = getDaysLeft(h.subscriptionEndDate);
          return left >= 0 && left <= 7;
        }).length;
        const countExpired = hotels.filter(h => {
          return h.subscriptionStatus === 'Expired' || (h.subscriptionEndDate && getDaysLeft(h.subscriptionEndDate) < 0);
        }).length;
        const countActive = hotels.filter(h => h.subscriptionStatus === 'Active' && getHotelStatus(h) === 'Approved').length;
        const countSuspended = hotels.filter(h => getHotelStatus(h) === 'Suspended' || getHotelStatus(h) === 'Rejected').length;

        const filteredHotels = hotels.filter(h => {
          const st = getHotelStatus(h);
          let matchesStatus = true;
          if (hotelFilter === 'Pending') matchesStatus = st === 'Pending';
          else if (hotelFilter === 'Approved') matchesStatus = st === 'Approved';
          else if (hotelFilter === 'Trial') matchesStatus = h.subscriptionPlan === 'Trial';
          else if (hotelFilter === 'Expiring') {
            matchesStatus = h.subscriptionStatus === 'Active' && getDaysLeft(h.subscriptionEndDate) >= 0 && getDaysLeft(h.subscriptionEndDate) <= 7;
          } else if (hotelFilter === 'Expired') {
            matchesStatus = h.subscriptionStatus === 'Expired' || Boolean(h.subscriptionEndDate && getDaysLeft(h.subscriptionEndDate) < 0);
          } else if (hotelFilter === 'Active') matchesStatus = h.subscriptionStatus === 'Active' && st === 'Approved';
          else if (hotelFilter === 'Suspended') matchesStatus = st === 'Suspended' || st === 'Rejected';

          if (!matchesStatus) return false;
          if (!hotelSearch.trim()) return true;
          const q = hotelSearch.toLowerCase();
          return (
            (h.name || '').toLowerCase().includes(q) ||
            (h.ownerName || '').toLowerCase().includes(q) ||
            (h.phoneNumber || '').toLowerCase().includes(q) ||
            (h.emailAddress || '').toLowerCase().includes(q) ||
            (h.id || '').toLowerCase().includes(q) ||
            (h.subscriptionPlan || '').toLowerCase().includes(q)
          );
        });

        return (
          <div className="space-y-6 animate-fade-in" id="hotel-management-panel">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs">
              <div>
                <h2 className="text-xl md:text-2xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2.5">
                  <Building className="w-6 h-6 text-luxury-gold-500" /> Tenant Properties Database
                </h2>
                <p className="text-xs text-luxury-brown-500 mt-1">
                  Manage independent multi-tenant hotel client systems, subscriptions, and isolated workspaces.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-4 h-4 text-luxury-brown-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={hotelSearch}
                    onChange={(e) => setHotelSearch(e.target.value)}
                    placeholder="Search hotel, owner, phone, ID..."
                    className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-luxury-brown-200 bg-luxury-beige-50/40 text-xs text-luxury-brown-900 focus:outline-none focus:border-luxury-gold-500 transition-colors"
                  />
                  {hotelSearch && (
                    <button
                      onClick={() => setHotelSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-luxury-brown-400 hover:text-luxury-brown-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => { setShowAddModal(true); setOnboardingStep(1); }}
                  className="inline-flex items-center gap-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all duration-300 text-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add Hotel Property
                </button>
              </div>
            </div>

            {/* Rich Filters Segment */}
            <div className="flex flex-wrap gap-2 pb-1">
              {[
                { key: 'All', label: 'All Hotels', count: countAll, color: 'text-luxury-brown-600 bg-luxury-beige-100' },
                { key: 'Pending', label: 'Pending Approval', count: countPending, color: 'text-amber-700 bg-amber-50 border-amber-100' },
                { key: 'Approved', label: 'Approved', count: countApproved, color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                { key: 'Trial', label: 'Free Trial', count: countTrial, color: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
                { key: 'Expiring', label: 'Expiring (7 Days)', count: countExpiring, color: 'text-orange-700 bg-orange-50 border-orange-100' },
                { key: 'Expired', label: 'Expired', count: countExpired, color: 'text-rose-700 bg-rose-50 border-rose-100' },
                { key: 'Active', label: 'Active', count: countActive, color: 'text-teal-700 bg-teal-50 border-teal-100' },
                { key: 'Suspended', label: 'Suspended / Rejected', count: countSuspended, color: 'text-slate-700 bg-slate-50 border-slate-100' }
              ].map(filterTab => {
                const isActive = hotelFilter === filterTab.key;
                return (
                  <button
                    key={filterTab.key}
                    onClick={() => setHotelFilter(filterTab.key as any)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-luxury-brown-900 border-luxury-brown-950 text-white shadow-xs font-bold' 
                        : 'bg-white border-luxury-brown-100 text-luxury-brown-600 hover:bg-luxury-beige-50'
                    }`}
                  >
                    <span>{filterTab.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${isActive ? 'bg-luxury-gold-500 text-luxury-brown-950' : 'bg-luxury-beige-100 text-luxury-brown-800'}`}>
                      {filterTab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Table Representation */}
            <div className="bg-white border border-luxury-brown-100 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-luxury-beige-50/70 border-b border-luxury-brown-100 text-luxury-brown-800 text-[10px] font-mono uppercase tracking-wider">
                      <th className="py-3.5 px-4 font-bold whitespace-nowrap">Hotel Property</th>
                      <th className="py-3.5 px-4 font-bold whitespace-nowrap">Owner & Contact</th>
                      <th className="py-3.5 px-3 font-bold text-center whitespace-nowrap">Rooms</th>
                      <th className="py-3.5 px-3 font-bold whitespace-nowrap">Package Plan</th>
                      <th className="py-3.5 px-3 font-bold whitespace-nowrap">Subscription Validity</th>
                      <th className="py-3.5 px-3 font-bold whitespace-nowrap">Approval Status</th>
                      <th className="py-3.5 px-4 font-bold text-right whitespace-nowrap">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-100/60 text-xs">
                    {filteredHotels.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-luxury-brown-400 font-medium">
                          No tenant properties matching the selected status filter.
                        </td>
                      </tr>
                    ) : (
                      filteredHotels.map(hotel => {
                        const stats = getHotelStats(hotel.id);
                        const daysLeft = getDaysLeft(hotel.subscriptionEndDate);
                        const isTrial = hotel.subscriptionPlan === 'Trial';
                        const status = getHotelStatus(hotel);
                        const roomCount = stats.totalRooms || (hotel.roomTierLimit === '1-10' ? 8 : hotel.roomTierLimit === '10-20' ? 15 : hotel.roomTierLimit === '20-30' ? 25 : 40);

                        return (
                          <tr key={hotel.id} className="hover:bg-luxury-beige-50/35 transition-colors group">
                            {/* 1. Hotel Property (Logo + Name + ID) */}
                            <td className="py-3.5 px-4 min-w-[210px]">
                              <div className="flex items-center gap-3">
                                <img 
                                  src={hotel.logoUrl} 
                                  alt={hotel.name}
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 rounded-xl object-cover border border-luxury-brown-100 shadow-2xs shrink-0" 
                                />
                                <div className="min-w-0">
                                  <div className="font-serif font-bold text-sm text-luxury-brown-950 truncate max-w-[180px]" title={hotel.name}>
                                    {hotel.name}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-luxury-brown-400 font-mono truncate max-w-[130px]" title={hotel.id}>
                                      ID: {hotel.id}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. Owner & Contact */}
                            <td className="py-3.5 px-4 min-w-[185px]">
                              <div className="font-semibold text-luxury-brown-900 text-xs truncate max-w-[180px]">
                                {hotel.ownerName || 'Property Owner'}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] font-mono text-luxury-brown-600 whitespace-nowrap mt-0.5">
                                <Phone className="w-3 h-3 text-luxury-gold-600 shrink-0" />
                                <span>{hotel.phoneNumber || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-luxury-brown-400 truncate max-w-[180px]" title={hotel.emailAddress}>
                                <Mail className="w-3 h-3 text-luxury-brown-300 shrink-0" />
                                <span className="truncate">{hotel.emailAddress || 'N/A'}</span>
                              </div>
                            </td>

                            {/* 3. Total Rooms & Capacity */}
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <div className="inline-flex flex-col items-center px-2.5 py-1 rounded-xl bg-luxury-beige-50/80 border border-luxury-brown-100/80">
                                <span className="font-mono font-bold text-sm text-luxury-brown-950 leading-none">{roomCount}</span>
                                <span className="text-[9px] text-luxury-brown-500 font-mono mt-0.5">Cap: {hotel.roomTierLimit || '1-10'}</span>
                              </div>
                            </td>

                            {/* 4. Package Plan */}
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wide border ${
                                isTrial
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}>
                                {hotel.subscriptionPlan || 'Monthly'}
                              </span>
                              {hotel.subscriptionPrice !== undefined && (
                                <span className="block text-[11px] text-luxury-brown-700 font-mono font-bold mt-1">
                                  ₹{Number(hotel.subscriptionPrice).toLocaleString('en-IN')}
                                </span>
                              )}
                            </td>

                            {/* 5. Subscription Validity & Expiry */}
                            <td className="py-3.5 px-3 font-mono whitespace-nowrap">
                              {hotel.subscriptionEndDate ? (
                                <div className="space-y-0.5">
                                  <div className={`text-xs font-bold ${daysLeft < 0 ? 'text-rose-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-emerald-700'}`}>
                                    {hotel.subscriptionEndDate}
                                  </div>
                                  <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    daysLeft < 0
                                      ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                      : daysLeft <= 7
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-emerald-50/70 text-emerald-700'
                                  }`}>
                                    {daysLeft < 0 ? 'Expired' : `${daysLeft} days left`}
                                  </span>
                                  {isTrial && (
                                    <div className="text-[9px] text-luxury-brown-400">
                                      Trial ends: {getTrialEndDate(hotel.trialStartDate)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-luxury-brown-400">N/A</span>
                              )}
                            </td>

                            {/* 6. Clean Single-Line Status Badge */}
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              {status === 'Approved' && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs whitespace-nowrap">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                  <span>Approved</span>
                                </span>
                              )}
                              {status === 'Pending' && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs whitespace-nowrap">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                  <span>Pending Approval</span>
                                </span>
                              )}
                              {status === 'Rejected' && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs whitespace-nowrap">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                  <span>Rejected</span>
                                </span>
                              )}
                              {status === 'Suspended' && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs whitespace-nowrap">
                                  <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
                                  <span>Suspended</span>
                                </span>
                              )}
                            </td>

                            {/* 7. Quick Actions */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {/* Primary Approval / Reactivation Action */}
                                {status === 'Pending' && (
                                  <button
                                    onClick={() => handleUpdateStatus(hotel.id, 'Approved')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-[11px] shadow-xs transition-all cursor-pointer whitespace-nowrap"
                                    title="Approve & Activate Hotel Property"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>Approve</span>
                                  </button>
                                )}

                                {(status === 'Suspended' || status === 'Rejected') && (
                                  <button
                                    onClick={() => handleUpdateStatus(hotel.id, 'Approved')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 font-bold text-[11px] transition-all cursor-pointer whitespace-nowrap"
                                    title="Re-Approve & Reactivate Hotel Property"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>Re-Approve</span>
                                  </button>
                                )}

                                {hotel.renewalRequest?.status === 'Pending' && (
                                  <button
                                    onClick={() => openRenewalModalForHotel(hotel)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-luxury-brown-950 font-bold text-[11px] shadow-xs transition-all cursor-pointer whitespace-nowrap"
                                    title="Verify Payment, Select Package & Generate Renewal Invoice"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                                    <span>Approve Renewal</span>
                                  </button>
                                )}

                                {Array.isArray(hotel.subscriptionInvoices) && hotel.subscriptionInvoices.length > 0 && (
                                  <button
                                    onClick={() => setViewingSubscriptionInvoice(hotel.subscriptionInvoices![0])}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-luxury-beige-100 hover:bg-luxury-gold-500 text-luxury-brown-900 font-mono font-bold text-[10px] border border-luxury-brown-200 transition-all cursor-pointer whitespace-nowrap"
                                    title="View / Print Latest Subscription Renewal Invoice"
                                  >
                                    <FileText className="w-3 h-3 shrink-0" />
                                    <span>Invoice</span>
                                  </button>
                                )}

                                {/* Icon Action Bar */}
                                <div className="inline-flex items-center bg-luxury-beige-50/70 border border-luxury-brown-100 rounded-xl p-0.5 gap-0.5">
                                  {/* Open Hotel PMS */}
                                  <button
                                    onClick={() => {
                                      handleImpersonate(hotel.id);
                                    }}
                                    className="p-1.5 hover:bg-white text-luxury-brown-600 hover:text-luxury-brown-950 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                    title="Open Hotel PMS Core Operations"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <ExternalLink className="w-2.5 h-2.5 text-luxury-gold-600" />
                                  </button>

                                  {/* Edit */}
                                  <button
                                    onClick={() => setEditingHotel(hotel)}
                                    className="p-1.5 hover:bg-white text-luxury-brown-600 hover:text-luxury-brown-950 rounded-lg transition-all cursor-pointer"
                                    title="Edit Hotel Profile"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Change Package */}
                                  <button
                                    onClick={() => setPackageChangingHotel(hotel)}
                                    className="p-1.5 hover:bg-white text-luxury-gold-700 hover:text-luxury-gold-600 rounded-lg transition-all cursor-pointer"
                                    title="Change Subscription Package"
                                  >
                                    <Sliders className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Renew & Generate Invoice */}
                                  <button
                                    onClick={() => openRenewalModalForHotel(hotel)}
                                    className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-all cursor-pointer"
                                    title="Renew Membership, Select Package & Generate Invoice"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Suspend (when Approved) */}
                                  {status === 'Approved' && (
                                    <button
                                      onClick={() => handleUpdateStatus(hotel.id, 'Suspended')}
                                      className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg transition-all cursor-pointer"
                                      title="Suspend Property"
                                    >
                                      <ShieldAlert className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {/* Delete */}
                                  {hotel.id !== 'hotel-1' && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Are you sure you want to decommission and remove "${hotel.name}"?`)) {
                                          onDeleteHotel(hotel.id);
                                          showToast(`Removed hotel property "${hotel.name}".`, 'info');
                                        }
                                      }}
                                      className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg transition-all cursor-pointer"
                                      title="Decommission Tenant"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {/* Login As Admin */}
                                  <button
                                    onClick={() => handleImpersonate(hotel.id)}
                                    disabled={status === 'Suspended' || status === 'Rejected'}
                                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                      status === 'Suspended' || status === 'Rejected'
                                        ? 'text-luxury-brown-300 cursor-not-allowed'
                                        : 'hover:bg-luxury-brown-900 hover:text-white text-luxury-brown-800'
                                    }`}
                                    title="Open Hotel Admin Workspace"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {activeSubTab === 'website' && (() => {
        const handleSaveWebsiteCms = async () => {
          const syncedHeroTitle = [
            cmsConfig.heroTitleLine1,
            cmsConfig.heroTitleLine2,
            cmsConfig.heroTitleLine3
          ]
            .filter(Boolean)
            .join(' ') || cmsConfig.heroTitle;

          const updatedConfig: SystemWebsiteConfig = {
            ...cmsConfig,
            heroTitle: syncedHeroTitle
          };
          onUpdateSystemWebsite(updatedConfig);
          try {
            const res = await syncAllToSupabase({ systemWebsite: updatedConfig });
            if (res && res.success) {
              setSaveSuccess(true);
              showToast('Website CMS saved successfully to live database!', 'success');
              setTimeout(() => setSaveSuccess(false), 3500);
            } else {
              showToast(res?.error || 'Failed to sync Website CMS to server', 'error');
            }
          } catch (e: any) {
            showToast(e?.message || 'Error saving Website CMS', 'error');
          }
        };

        const heroTrustBadges = cmsConfig.heroTrustBadges || [];
        const heroBottomPillars = cmsConfig.heroBottomPillars || [];
        const featureCards = cmsConfig.featureCards || [];
        const pricingCards = cmsConfig.pricingCards || [];
        const visionPillars = cmsConfig.visionPillars || [];
        const testimonials = cmsConfig.testimonials || [];
        const customSections = cmsConfig.customSections || [];

        return (
          <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 md:p-8 space-y-8 shadow-sm">
            {/* Top Header & Save Action */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-luxury-brown-100">
              <div>
                <h2 className="text-2xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <Globe className="w-6 h-6 text-luxury-gold-500" />{' '}
                  {cmsConfig.businessName || 'DirectStay'} Full Website CMS Editor
                </h2>
                <p className="text-xs text-luxury-brown-500 mt-1">
                  Customize every section of the public website: Navbar, WhatsApp, Hero, Features, Pricing Plans, Vision, Testimonials, Contact, Footer &amp; Custom Sections.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveWebsiteCms}
                  className="inline-flex items-center gap-2 py-3 px-6 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow-md transition-all duration-200 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save All Website Changes</span>
                </button>
              </div>
            </div>

            {saveSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-semibold">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>All website sections, pricing cards, WhatsApp settings, footer, and custom sections have been saved!</span>
              </div>
            )}

            {/* Quick Section Jump Pills */}
            <div className="flex flex-wrap gap-2 bg-luxury-beige-50/70 p-3 rounded-2xl border border-luxury-brown-100 text-[11px] font-mono font-bold">
              <button type="button" onClick={() => document.getElementById('cms-identity')?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1.5 rounded-lg bg-white border border-luxury-brown-100 text-luxury-brown-800 hover:border-luxury-gold-500 cursor-pointer">1. Identity, Navbar &amp; WhatsApp</button>
              <button type="button" onClick={() => document.getElementById('cms-hero')?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1.5 rounded-lg bg-white border border-luxury-brown-100 text-luxury-brown-800 hover:border-luxury-gold-500 cursor-pointer">2. Hero &amp; 4 Bottom Pillars</button>
              <button type="button" onClick={() => document.getElementById('cms-features')?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1.5 rounded-lg bg-white border border-luxury-brown-100 text-luxury-brown-800 hover:border-luxury-gold-500 cursor-pointer">3. Features Cards</button>
              <button type="button" onClick={() => document.getElementById('cms-pricing')?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1.5 rounded-lg bg-white border border-luxury-brown-100 text-luxury-brown-800 hover:border-luxury-gold-500 cursor-pointer">4. Pricing Plans</button>
              <button type="button" onClick={() => document.getElementById('cms-vision')?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1.5 rounded-lg bg-white border border-luxury-brown-100 text-luxury-brown-800 hover:border-luxury-gold-500 cursor-pointer">5. Our Vision</button>
              <button type="button" onClick={() => document.getElementById('cms-testimonials')?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1.5 rounded-lg bg-white border border-luxury-brown-100 text-luxury-brown-800 hover:border-luxury-gold-500 cursor-pointer">6. Testimonials</button>
              <button type="button" onClick={() => document.getElementById('cms-contact')?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1.5 rounded-lg bg-white border border-luxury-brown-100 text-luxury-brown-800 hover:border-luxury-gold-500 cursor-pointer">7. Contact Us</button>
              <button type="button" onClick={() => document.getElementById('cms-footer')?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1.5 rounded-lg bg-white border border-luxury-brown-100 text-luxury-brown-800 hover:border-luxury-gold-500 cursor-pointer">8. Footer</button>
              <button type="button" onClick={() => document.getElementById('cms-custom-sections')?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1.5 rounded-lg bg-luxury-gold-500/20 border border-luxury-gold-500 text-luxury-brown-950 cursor-pointer">+ 9. Add New Custom Sections</button>
            </div>

            {/* ============================================================== */}
            {/* SECTION 1: CORE IDENTITY, NAVBAR & FLOATING WHATSAPP           */}
            {/* ============================================================== */}
            <div id="cms-identity" className="p-5 sm:p-6 rounded-2xl bg-luxury-beige-50/40 border border-luxury-brown-100 space-y-5">
              <h3 className="text-sm uppercase font-mono tracking-wider font-bold text-luxury-gold-600 pb-2 border-b border-luxury-brown-100">
                1. Core Identity, Navbar &amp; Floating WhatsApp Configuration
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">SaaS Business Name</label>
                  <input
                    type="text"
                    value={cmsConfig.businessName || ''}
                    onChange={(e) => updateCmsField('businessName', e.target.value)}
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Navbar Top Tagline</label>
                  <input
                    type="text"
                    value={cmsConfig.brandTagline || ''}
                    onChange={(e) => updateCmsField('brandTagline', e.target.value)}
                    placeholder="Boutique SaaS Network"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">SaaS Brand Logo URL</label>
                  <input
                    type="text"
                    value={cmsConfig.logoUrl || ''}
                    onChange={(e) => updateCmsField('logoUrl', e.target.value)}
                    placeholder="URL or Base64 Image"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Navbar Sign-In Button Text</label>
                  <input
                    type="text"
                    value={cmsConfig.navSignInText || ''}
                    onChange={(e) => updateCmsField('navSignInText', e.target.value)}
                    placeholder="Sign In Console"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Navbar Onboard Button Text</label>
                  <input
                    type="text"
                    value={cmsConfig.navOnboardText || ''}
                    onChange={(e) => updateCmsField('navOnboardText', e.target.value)}
                    placeholder="Onboard My Hotel"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Support Helpline Phone Number</label>
                  <input
                    type="text"
                    value={cmsConfig.supportPhone || ''}
                    onChange={(e) => updateCmsField('supportPhone', e.target.value)}
                    placeholder="8260502545"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-emerald-700 block">Floating WhatsApp Number (Direct Redirect)</label>
                  <input
                    type="text"
                    value={cmsConfig.whatsappNumber || ''}
                    onChange={(e) => updateCmsField('whatsappNumber', e.target.value)}
                    placeholder="e.g. 918260502545 or 8260502545"
                    className="w-full text-sm bg-emerald-50/40 border border-emerald-200 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-luxury-brown-950 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-emerald-700 block">WhatsApp Pre-Filled Welcome Message</label>
                  <input
                    type="text"
                    value={cmsConfig.whatsappDefaultMessage || ''}
                    onChange={(e) => updateCmsField('whatsappDefaultMessage', e.target.value)}
                    placeholder="Hello DirectStay Team, I would like to inquire about onboarding my hotel property."
                    className="w-full text-sm bg-emerald-50/40 border border-emerald-200 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-luxury-brown-950"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="has-whatsapp-check"
                  checked={cmsConfig.hasWhatsapp !== false}
                  onChange={(e) => updateCmsField('hasWhatsapp', e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-luxury-brown-200 rounded focus:ring-emerald-500"
                />
                <label htmlFor="has-whatsapp-check" className="text-xs font-bold text-luxury-brown-800 cursor-pointer">
                  Show Floating WhatsApp Redirect Button on Bottom-Right of Public Website ({cmsConfig.whatsappNumber || cmsConfig.supportPhone})
                </label>
              </div>
            </div>

            {/* ============================================================== */}
            {/* SECTION 2: LANDING HERO SECTION & 4 BOTTOM PILLARS             */}
            {/* ============================================================== */}
            <div id="cms-hero" className="p-5 sm:p-6 rounded-2xl bg-luxury-beige-50/40 border border-luxury-brown-100 space-y-5">
              <h3 className="text-sm uppercase font-mono tracking-wider font-bold text-luxury-gold-600 pb-2 border-b border-luxury-brown-100">
                2. Landing Hero Section &amp; Bottom 4 Feature Pillars
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Hero Top Pill Badge Text</label>
                  <input
                    type="text"
                    value={cmsConfig.heroBadgeText || ''}
                    onChange={(e) => updateCmsField('heroBadgeText', e.target.value)}
                    placeholder="Next-Generation Hospitality SaaS Engine"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Hero Background Image URL</label>
                  <input
                    type="text"
                    value={cmsConfig.heroBgImageUrl || ''}
                    onChange={(e) => updateCmsField('heroBgImageUrl', e.target.value)}
                    placeholder="/hero-resort.jpg"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Hero Headline Line 1</label>
                  <input
                    type="text"
                    value={cmsConfig.heroTitleLine1 || ''}
                    onChange={(e) => updateCmsField('heroTitleLine1', e.target.value)}
                    placeholder="The Definitive Property"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950 font-serif font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Hero Headline Line 2</label>
                  <input
                    type="text"
                    value={cmsConfig.heroTitleLine2 || ''}
                    onChange={(e) => updateCmsField('heroTitleLine2', e.target.value)}
                    placeholder="Management System for"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950 font-serif font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-gold-600 block">Hero Headline Line 3 (Gold Highlight)</label>
                  <input
                    type="text"
                    value={cmsConfig.heroTitleLine3 || ''}
                    onChange={(e) => updateCmsField('heroTitleLine3', e.target.value)}
                    placeholder="DirectStay Hoteliers"
                    className="w-full text-sm bg-white border border-luxury-gold-500/50 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950 font-serif font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-luxury-brown-700 block">Hero Subtitle / Description Paragraph</label>
                <textarea
                  rows={2}
                  value={cmsConfig.heroSubtitle || ''}
                  onChange={(e) => updateCmsField('heroSubtitle', e.target.value)}
                  className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Primary CTA Button Text</label>
                  <input
                    type="text"
                    value={cmsConfig.heroPrimaryCtaText || ''}
                    onChange={(e) => updateCmsField('heroPrimaryCtaText', e.target.value)}
                    placeholder="Start 7-Day Free Trial"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Secondary CTA Button Text</label>
                  <input
                    type="text"
                    value={cmsConfig.heroSecondaryCtaText || ''}
                    onChange={(e) => updateCmsField('heroSecondaryCtaText', e.target.value)}
                    placeholder="Explore Package Pricing"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950"
                  />
                </div>
              </div>

              {/* Hero Trust Checkmark Badges */}
              <div className="space-y-2 pt-2 border-t border-luxury-brown-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-luxury-brown-800">Hero Checkmark Trust Badges</label>
                  <button
                    type="button"
                    onClick={() => updateCmsField('heroTrustBadges', [...heroTrustBadges, 'New Trust Benefit'])}
                    className="inline-flex items-center gap-1 text-xs font-bold text-luxury-gold-600 hover:text-luxury-brown-950 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Badge
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {heroTrustBadges.map((badge, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={badge}
                        onChange={(e) => {
                          const next = [...heroTrustBadges];
                          next[idx] = e.target.value;
                          updateCmsField('heroTrustBadges', next);
                        }}
                        className="flex-1 text-xs bg-white border border-luxury-brown-100 rounded-lg px-3 py-1.5 text-luxury-brown-950"
                      />
                      <button
                        type="button"
                        onClick={() => updateCmsField('heroTrustBadges', heroTrustBadges.filter((_, i) => i !== idx))}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Remove badge"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hero Bottom 4 Feature Strip Pillars */}
              <div className="space-y-3 pt-2 border-t border-luxury-brown-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-luxury-brown-800">Hero Bottom Strip Pillars (4-Column Bar)</label>
                  <button
                    type="button"
                    onClick={() =>
                      updateCmsField('heroBottomPillars', [
                        ...heroBottomPillars,
                        { id: `hp-${Date.now()}`, title: 'New Pillar Title', subtitle: 'Short pillar description' }
                      ])
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-luxury-gold-600 hover:text-luxury-brown-950 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Pillar
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {heroBottomPillars.map((pillar, idx) => (
                    <div key={pillar.id || idx} className="p-3 bg-white rounded-xl border border-luxury-brown-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-luxury-gold-600 font-bold">Pillar #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => updateCmsField('heroBottomPillars', heroBottomPillars.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                          title="Delete pillar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={pillar.title}
                        onChange={(e) => {
                          const next = [...heroBottomPillars];
                          next[idx] = { ...pillar, title: e.target.value };
                          updateCmsField('heroBottomPillars', next);
                        }}
                        placeholder="Pillar Title"
                        className="w-full text-xs font-bold bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                      />
                      <input
                        type="text"
                        value={pillar.subtitle}
                        onChange={(e) => {
                          const next = [...heroBottomPillars];
                          next[idx] = { ...pillar, subtitle: e.target.value };
                          updateCmsField('heroBottomPillars', next);
                        }}
                        placeholder="Pillar Subtitle"
                        className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-700"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* SECTION 3: CORE FEATURES SECTION                               */}
            {/* ============================================================== */}
            <div id="cms-features" className="p-5 sm:p-6 rounded-2xl bg-luxury-beige-50/40 border border-luxury-brown-100 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-luxury-brown-100">
                <h3 className="text-sm uppercase font-mono tracking-wider font-bold text-luxury-gold-600">
                  3. Core Features Section (#features)
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    updateCmsField('featureCards', [
                      ...featureCards,
                      {
                        id: `fc-${Date.now()}`,
                        title: 'New Platform Capability',
                        description: 'Describe how this capability helps boutique hotels operate more profitably.',
                        bullets: ['Key highlight one', 'Key highlight two']
                      }
                    ])
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-luxury-brown-900 hover:bg-luxury-brown-950 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Feature Card
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Features Section Heading</label>
                  <input
                    type="text"
                    value={cmsConfig.featuresHeading || ''}
                    onChange={(e) => updateCmsField('featuresHeading', e.target.value)}
                    placeholder="Full-Spectrum Property Control"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950 font-serif font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Features Section Subtitle</label>
                  <input
                    type="text"
                    value={cmsConfig.featuresSubtitle || ''}
                    onChange={(e) => updateCmsField('featuresSubtitle', e.target.value)}
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {featureCards.map((card, idx) => (
                  <div key={card.id || idx} className="p-4 bg-white rounded-2xl border border-luxury-brown-100 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-luxury-gold-600 font-bold">Feature Card #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => updateCmsField('featureCards', featureCards.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete Feature Card"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-luxury-brown-700 block">Card Title</label>
                        <input
                          type="text"
                          value={card.title}
                          onChange={(e) => {
                            const next = [...featureCards];
                            next[idx] = { ...card, title: e.target.value };
                            updateCmsField('featureCards', next);
                          }}
                          className="w-full text-xs font-bold bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-3 py-2 text-luxury-brown-950"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-luxury-brown-700 block">Card Description</label>
                        <textarea
                          rows={3}
                          value={card.description}
                          onChange={(e) => {
                            const next = [...featureCards];
                            next[idx] = { ...card, description: e.target.value };
                            updateCmsField('featureCards', next);
                          }}
                          className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-3 py-2 text-luxury-brown-800 resize-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-luxury-brown-700">Checkmark Bullets</label>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...featureCards];
                              next[idx] = { ...card, bullets: [...(card.bullets || []), 'New Feature Highlight'] };
                              updateCmsField('featureCards', next);
                            }}
                            className="text-[11px] text-luxury-gold-600 font-bold hover:underline cursor-pointer"
                          >
                            + Add Bullet
                          </button>
                        </div>
                        {(card.bullets || []).map((b, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={b}
                              onChange={(e) => {
                                const nextBullets = [...(card.bullets || [])];
                                nextBullets[bIdx] = e.target.value;
                                const next = [...featureCards];
                                next[idx] = { ...card, bullets: nextBullets };
                                updateCmsField('featureCards', next);
                              }}
                              className="flex-1 text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-900"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const nextBullets = (card.bullets || []).filter((_, i) => i !== bIdx);
                                const next = [...featureCards];
                                next[idx] = { ...card, bullets: nextBullets };
                                updateCmsField('featureCards', next);
                              }}
                              className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ============================================================== */}
            {/* SECTION 4: PRICING PLANS SECTION                               */}
            {/* ============================================================== */}
            <div id="cms-pricing" className="p-5 sm:p-6 rounded-2xl bg-luxury-beige-50/40 border border-luxury-brown-100 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-luxury-brown-100">
                <h3 className="text-sm uppercase font-mono tracking-wider font-bold text-luxury-gold-600">
                  4. Pricing Plans Section (#pricing)
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    updateCmsField('pricingCards', [
                      ...pricingCards,
                      {
                        id: `pc-${Date.now()}`,
                        planKey: 'Yearly',
                        title: 'Custom Enterprise Pack',
                        description: 'Tailored package for multi-property hotel groups.',
                        priceText: '₹24,999',
                        periodText: '/ Year',
                        gstText: '+ 18% GST Applicable',
                        features: ['Unlimited Rooms capability', '24/7 Priority Concierge Desk'],
                        buttonText: 'Select Enterprise Pack',
                        isPopular: false,
                        badgeText: ''
                      }
                    ])
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-luxury-brown-900 hover:bg-luxury-brown-950 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Pricing Plan Card
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Pricing Section Heading</label>
                  <input
                    type="text"
                    value={cmsConfig.pricingHeading || ''}
                    onChange={(e) => updateCmsField('pricingHeading', e.target.value)}
                    placeholder="Select Your Premium SaaS Package"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950 font-serif font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Pricing Section Subtitle</label>
                  <input
                    type="text"
                    value={cmsConfig.pricingSubtitle || ''}
                    onChange={(e) => updateCmsField('pricingSubtitle', e.target.value)}
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pricingCards.map((plan, idx) => (
                  <div
                    key={plan.id || idx}
                    className={`p-4 bg-white rounded-2xl border space-y-3 ${
                      (plan.isPopular ?? plan.isHighlighted) ? 'border-luxury-gold-500 ring-1 ring-luxury-gold-500/30' : 'border-luxury-brown-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-luxury-gold-600 font-bold">
                        Pricing Card #{idx + 1} ({plan.planKey})
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-luxury-brown-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(plan.isPopular ?? plan.isHighlighted)}
                            onChange={(e) => {
                              const next = [...pricingCards];
                              next[idx] = { ...plan, isPopular: e.target.checked, isHighlighted: e.target.checked };
                              updateCmsField('pricingCards', next);
                            }}
                            className="rounded text-luxury-gold-500"
                          />
                          <span>Highlight Popular</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => updateCmsField('pricingCards', pricingCards.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete Plan Card"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-luxury-brown-700 block">Plan Title</label>
                        <input
                          type="text"
                          value={plan.title}
                          onChange={(e) => {
                            const next = [...pricingCards];
                            next[idx] = { ...plan, title: e.target.value };
                            updateCmsField('pricingCards', next);
                          }}
                          className="w-full text-xs font-bold bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-luxury-brown-700 block">Onboarding Plan Target</label>
                        <select
                          value={plan.planKey}
                          onChange={(e) => {
                            const next = [...pricingCards];
                            next[idx] = { ...plan, planKey: e.target.value as WebsitePricingCard['planKey'] };
                            updateCmsField('pricingCards', next);
                          }}
                          className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                        >
                          <option value="Trial">Trial (7-Day Free Trial)</option>
                          <option value="Monthly">Monthly (1 Month Pack)</option>
                          <option value="HalfYearly">HalfYearly (6 Month Pack)</option>
                          <option value="Yearly">Yearly (1 Year Pack)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-luxury-brown-700 block">Displayed Price (e.g. ₹1,899)</label>
                        <input
                          type="text"
                          value={plan.priceText}
                          onChange={(e) => {
                            const next = [...pricingCards];
                            next[idx] = { ...plan, priceText: e.target.value };
                            updateCmsField('pricingCards', next);
                          }}
                          className="w-full text-xs font-bold bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-luxury-brown-700 block">Billing Period (e.g. / Month)</label>
                        <input
                          type="text"
                          value={plan.periodText}
                          onChange={(e) => {
                            const next = [...pricingCards];
                            next[idx] = { ...plan, periodText: e.target.value };
                            updateCmsField('pricingCards', next);
                          }}
                          className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-luxury-brown-700 block">GST / Tax Subtext</label>
                        <input
                          type="text"
                          value={plan.gstText}
                          onChange={(e) => {
                            const next = [...pricingCards];
                            next[idx] = { ...plan, gstText: e.target.value };
                            updateCmsField('pricingCards', next);
                          }}
                          className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-luxury-brown-700 block">Button Text &amp; Badge</label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={plan.buttonText}
                            onChange={(e) => {
                              const next = [...pricingCards];
                              next[idx] = { ...plan, buttonText: e.target.value };
                              updateCmsField('pricingCards', next);
                            }}
                            placeholder="Button Text"
                            className="w-1/2 text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2 py-1.5 text-luxury-brown-950"
                          />
                          <input
                            type="text"
                            value={plan.badgeText || ''}
                            onChange={(e) => {
                              const next = [...pricingCards];
                              next[idx] = { ...plan, badgeText: e.target.value };
                              updateCmsField('pricingCards', next);
                            }}
                            placeholder="Ribbon Badge (optional)"
                            className="w-1/2 text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2 py-1.5 text-luxury-brown-950"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-luxury-brown-700 block">Plan Short Description</label>
                      <input
                        type="text"
                        value={plan.description}
                        onChange={(e) => {
                          const next = [...pricingCards];
                          next[idx] = { ...plan, description: e.target.value };
                          updateCmsField('pricingCards', next);
                        }}
                        className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-800"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-luxury-brown-700">Included Plan Features</label>
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...pricingCards];
                            next[idx] = { ...plan, features: [...(plan.features || []), 'New Plan Feature'] };
                            updateCmsField('pricingCards', next);
                          }}
                          className="text-[11px] text-luxury-gold-600 font-bold hover:underline cursor-pointer"
                        >
                          + Add Feature Line
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {(plan.features || []).map((feat, fIdx) => (
                          <div key={fIdx} className="flex items-center gap-1">
                            <input
                              type="text"
                              value={feat}
                              onChange={(e) => {
                                const nextFeats = [...(plan.features || [])];
                                nextFeats[fIdx] = e.target.value;
                                const next = [...pricingCards];
                                next[idx] = { ...plan, features: nextFeats };
                                updateCmsField('pricingCards', next);
                              }}
                              className="flex-1 text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2 py-1 text-luxury-brown-900"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const nextFeats = (plan.features || []).filter((_, i) => i !== fIdx);
                                const next = [...pricingCards];
                                next[idx] = { ...plan, features: nextFeats };
                                updateCmsField('pricingCards', next);
                              }}
                              className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ============================================================== */}
            {/* SECTION 5: OUR VISION SECTION                                  */}
            {/* ============================================================== */}
            <div id="cms-vision" className="p-5 sm:p-6 rounded-2xl bg-luxury-beige-50/40 border border-luxury-brown-100 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-luxury-brown-100">
                <h3 className="text-sm uppercase font-mono tracking-wider font-bold text-luxury-gold-600">
                  5. Our Vision Section (#vision)
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    updateCmsField('visionPillars', [
                      ...visionPillars,
                      { id: `vp-${Date.now()}`, title: 'New Vision Pillar', description: 'Supporting vision statement.' }
                    ])
                  }
                  className="inline-flex items-center gap-1 text-xs font-bold text-luxury-gold-600 hover:text-luxury-brown-950 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Vision Pillar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Vision Section Heading</label>
                  <input
                    type="text"
                    value={cmsConfig.visionTitle || ''}
                    onChange={(e) => updateCmsField('visionTitle', e.target.value)}
                    placeholder="Pioneering Commission-Free Hospitality"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950 font-serif font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Vision Statement Quote</label>
                  <textarea
                    rows={2}
                    value={cmsConfig.visionContent || ''}
                    onChange={(e) => updateCmsField('visionContent', e.target.value)}
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950 resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {visionPillars.map((vp, idx) => (
                  <div key={vp.id || idx} className="p-3.5 bg-white rounded-xl border border-luxury-brown-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-luxury-gold-600 font-bold">Vision Pillar #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => updateCmsField('visionPillars', visionPillars.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={vp.title}
                      onChange={(e) => {
                        const next = [...visionPillars];
                        next[idx] = { ...vp, title: e.target.value };
                        updateCmsField('visionPillars', next);
                      }}
                      placeholder="Pillar Title"
                      className="w-full text-xs font-bold bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                    />
                    <textarea
                      rows={2}
                      value={vp.description}
                      onChange={(e) => {
                        const next = [...visionPillars];
                        next[idx] = { ...vp, description: e.target.value };
                        updateCmsField('visionPillars', next);
                      }}
                      placeholder="Pillar Description"
                      className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-700 resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ============================================================== */}
            {/* SECTION 6: CLIENT TESTIMONIALS SECTION                         */}
            {/* ============================================================== */}
            <div id="cms-testimonials" className="p-5 sm:p-6 rounded-2xl bg-luxury-beige-50/40 border border-luxury-brown-100 space-y-5">
              <h3 className="text-sm uppercase font-mono tracking-wider font-bold text-luxury-gold-600 pb-2 border-b border-luxury-brown-100">
                6. Client Testimonials Section (#testimonials)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Testimonials Section Heading</label>
                  <input
                    type="text"
                    value={cmsConfig.testimonialsHeading || ''}
                    onChange={(e) => updateCmsField('testimonialsHeading', e.target.value)}
                    placeholder="Client Success Stories"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950 font-serif font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Testimonials Section Subtitle</label>
                  <input
                    type="text"
                    value={cmsConfig.testimonialsSubtitle || ''}
                    onChange={(e) => updateCmsField('testimonialsSubtitle', e.target.value)}
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950"
                  />
                </div>
              </div>

              {/* Existing Testimonials Editable List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {testimonials.map((t, idx) => (
                  <div key={t.id} className="p-4 bg-white rounded-2xl border border-luxury-brown-100 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={t.authorName}
                        onChange={(e) => {
                          const next = [...testimonials];
                          next[idx] = { ...t, authorName: e.target.value };
                          updateCmsField('testimonials', next);
                        }}
                        placeholder="Author Name"
                        className="font-bold text-luxury-brown-950 bg-luxury-beige-50/60 border border-luxury-brown-100 rounded-lg px-2.5 py-1 flex-1"
                      />
                      <input
                        type="text"
                        value={t.hotelName}
                        onChange={(e) => {
                          const next = [...testimonials];
                          next[idx] = { ...t, hotelName: e.target.value };
                          updateCmsField('testimonials', next);
                        }}
                        placeholder="Hotel Name"
                        className="font-mono text-luxury-gold-600 bg-luxury-beige-50/60 border border-luxury-brown-100 rounded-lg px-2.5 py-1 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => updateCmsField('testimonials', testimonials.filter((item) => item.id !== t.id))}
                        className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg shrink-0 cursor-pointer"
                        title="Delete testimonial"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={t.content}
                      onChange={(e) => {
                        const next = [...testimonials];
                        next[idx] = { ...t, content: e.target.value };
                        updateCmsField('testimonials', next);
                      }}
                      className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-700 resize-none"
                    />
                  </div>
                ))}
                {testimonials.length === 0 && (
                  <p className="col-span-full text-center text-xs text-luxury-brown-400 font-mono py-3">
                    No testimonials added yet. Use the form below to add a client review.
                  </p>
                )}
              </div>

              {/* Add New Testimonial Form */}
              <div className="bg-white border border-luxury-brown-100 p-4 rounded-2xl space-y-3">
                <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-600 flex items-center gap-1">
                  <PlusCircle className="w-3.5 h-3.5" /> Add New Client Testimonial
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Author Name (e.g. Raghunath P.)"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-xl px-3 py-2 text-luxury-brown-950"
                  />
                  <input
                    type="text"
                    placeholder="Hotel Name (e.g. Mayfair Puri)"
                    value={newHotelNameTestimonial}
                    onChange={(e) => setNewHotelNameTestimonial(e.target.value)}
                    className="text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-xl px-3 py-2 text-luxury-brown-950"
                  />
                  <div className="flex gap-1.5 items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-bold cursor-pointer ${
                          newRating === star
                            ? 'bg-luxury-gold-500 text-luxury-brown-950'
                            : 'bg-luxury-beige-50 border border-luxury-brown-100 text-luxury-brown-600'
                        }`}
                      >
                        {star} ★
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Review Message..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="flex-1 text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-xl px-3 py-2 text-luxury-brown-950"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newAuthor.trim() || !newContent.trim()) {
                        showToast('Please specify author name and testimonial message content.', 'warning');
                        return;
                      }
                      const newTestimonial: Testimonial = {
                        id: `t-${Date.now()}`,
                        authorName: newAuthor.trim(),
                        hotelName: newHotelNameTestimonial.trim() || 'Resort Operator',
                        content: newContent.trim(),
                        rating: newRating
                      };
                      updateCmsField('testimonials', [...testimonials, newTestimonial]);
                      setNewAuthor('');
                      setNewHotelNameTestimonial('');
                      setNewContent('');
                      setNewRating(5);
                    }}
                    className="px-5 py-2 bg-luxury-brown-900 hover:bg-luxury-brown-950 text-white font-serif font-bold text-xs rounded-xl cursor-pointer shrink-0"
                  >
                    + Add Testimonial
                  </button>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* SECTION 7: CONTACT US SECTION                                  */}
            {/* ============================================================== */}
            <div id="cms-contact" className="p-5 sm:p-6 rounded-2xl bg-luxury-beige-50/40 border border-luxury-brown-100 space-y-5">
              <h3 className="text-sm uppercase font-mono tracking-wider font-bold text-luxury-gold-600 pb-2 border-b border-luxury-brown-100">
                7. Contact Us Section (#contact)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Contact Section Heading</label>
                  <input
                    type="text"
                    value={cmsConfig.contactHeading || ''}
                    onChange={(e) => updateCmsField('contactHeading', e.target.value)}
                    placeholder="Let's Discuss Your Growth"
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950 font-serif font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Contact Section Subtitle</label>
                  <input
                    type="text"
                    value={cmsConfig.contactSubtitle || ''}
                    onChange={(e) => updateCmsField('contactSubtitle', e.target.value)}
                    className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: Email */}
                <div className="p-4 bg-white rounded-xl border border-luxury-brown-100 space-y-2.5">
                  <span className="text-[10px] font-mono uppercase text-luxury-gold-600 font-bold">Contact Card 1 (Email)</span>
                  <input
                    type="text"
                    value={cmsConfig.contactEmailTitle || ''}
                    onChange={(e) => updateCmsField('contactEmailTitle', e.target.value)}
                    placeholder="Email Us"
                    className="w-full text-xs font-bold bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                  />
                  <input
                    type="text"
                    value={cmsConfig.contactEmailSubtitle || ''}
                    onChange={(e) => updateCmsField('contactEmailSubtitle', e.target.value)}
                    placeholder="Direct Enterprise & Onboarding Desk"
                    className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-700"
                  />
                  <input
                    type="email"
                    value={cmsConfig.supportEmail || ''}
                    onChange={(e) => updateCmsField('supportEmail', e.target.value)}
                    placeholder="ops@directstay.in"
                    className="w-full text-xs font-mono bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                  />
                </div>

                {/* Card 2: Helpline */}
                <div className="p-4 bg-white rounded-xl border border-luxury-brown-100 space-y-2.5">
                  <span className="text-[10px] font-mono uppercase text-luxury-gold-600 font-bold">Contact Card 2 (Phone Helpline)</span>
                  <input
                    type="text"
                    value={cmsConfig.contactPhoneTitle || ''}
                    onChange={(e) => updateCmsField('contactPhoneTitle', e.target.value)}
                    placeholder="Call Helpline"
                    className="w-full text-xs font-bold bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                  />
                  <input
                    type="text"
                    value={cmsConfig.contactPhoneSubtitle || ''}
                    onChange={(e) => updateCmsField('contactPhoneSubtitle', e.target.value)}
                    placeholder="Priority Setup & Technical Support Line"
                    className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-700"
                  />
                  <input
                    type="text"
                    value={cmsConfig.supportPhone || ''}
                    onChange={(e) => updateCmsField('supportPhone', e.target.value)}
                    placeholder="8260502545"
                    className="w-full text-xs font-mono bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                  />
                </div>

                {/* Card 3: Headquarters */}
                <div className="p-4 bg-white rounded-xl border border-luxury-brown-100 space-y-2.5">
                  <span className="text-[10px] font-mono uppercase text-luxury-gold-600 font-bold">Contact Card 3 (Headquarters)</span>
                  <input
                    type="text"
                    value={cmsConfig.contactAddressTitle || ''}
                    onChange={(e) => updateCmsField('contactAddressTitle', e.target.value)}
                    placeholder="Headquarters"
                    className="w-full text-xs font-bold bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                  />
                  <input
                    type="text"
                    value={cmsConfig.contactAddressSubtitle || ''}
                    onChange={(e) => updateCmsField('contactAddressSubtitle', e.target.value)}
                    placeholder="Registered Hospitality Operations Hub"
                    className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-700"
                  />
                  <input
                    type="text"
                    value={cmsConfig.contactAddress || ''}
                    onChange={(e) => updateCmsField('contactAddress', e.target.value)}
                    placeholder="Physical Address"
                    className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                  />
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* SECTION 8: WEBSITE FOOTER CONFIGURATION                        */}
            {/* ============================================================== */}
            <div id="cms-footer" className="p-5 sm:p-6 rounded-2xl bg-luxury-beige-50/40 border border-luxury-brown-100 space-y-5">
              <h3 className="text-sm uppercase font-mono tracking-wider font-bold text-luxury-gold-600 pb-2 border-b border-luxury-brown-100">
                8. Website Footer Content &amp; Legal/GST Disclaimers
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Footer Brand Subtitle</label>
                  <input
                    type="text"
                    value={cmsConfig.footerTagline || ''}
                    onChange={(e) => updateCmsField('footerTagline', e.target.value)}
                    placeholder="Boutique SaaS System"
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 text-luxury-brown-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Column 1 Heading</label>
                  <input
                    type="text"
                    value={cmsConfig.footerPlatformTitle || ''}
                    onChange={(e) => updateCmsField('footerPlatformTitle', e.target.value)}
                    placeholder="Platform"
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 text-luxury-brown-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Column 2 Heading</label>
                  <input
                    type="text"
                    value={cmsConfig.footerEnterpriseTitle || ''}
                    onChange={(e) => updateCmsField('footerEnterpriseTitle', e.target.value)}
                    placeholder="Enterprise & Portals"
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 text-luxury-brown-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Column 3 Heading</label>
                  <input
                    type="text"
                    value={cmsConfig.footerDirectDeskTitle || ''}
                    onChange={(e) => updateCmsField('footerDirectDeskTitle', e.target.value)}
                    placeholder="Direct Desk"
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 text-luxury-brown-950"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-luxury-brown-700 block">Footer Brand Description Paragraph</label>
                <textarea
                  rows={2}
                  value={cmsConfig.footerDescription || ''}
                  onChange={(e) => updateCmsField('footerDescription', e.target.value)}
                  className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Custom Copyright Line (Leave blank for automatic)</label>
                  <input
                    type="text"
                    value={cmsConfig.footerCopyrightText || ''}
                    onChange={(e) => updateCmsField('footerCopyrightText', e.target.value)}
                    placeholder={`© 2026 ${cmsConfig.businessName || 'DirectStay'}. All rights reserved.`}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-luxury-brown-700 block">Bottom GST &amp; Tax Disclaimer</label>
                  <input
                    type="text"
                    value={cmsConfig.footerGstDisclaimer || ''}
                    onChange={(e) => updateCmsField('footerGstDisclaimer', e.target.value)}
                    placeholder="All listed premium plan packages are subject to 18% GST standard regulations."
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950"
                  />
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* SECTION 9: CUSTOM DYNAMIC WEBSITE SECTIONS BUILDER             */}
            {/* ============================================================== */}
            <div id="cms-custom-sections" className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-luxury-beige-50/70 to-white border-2 border-luxury-gold-500/40 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-luxury-brown-100">
                <div>
                  <h3 className="text-sm uppercase font-mono tracking-wider font-bold text-luxury-brown-950 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-luxury-gold-500" /> 9. Custom Homepage Sections Builder (Add Unlimited New Sections)
                  </h3>
                  <p className="text-xs text-luxury-brown-500 mt-0.5">
                    Create brand new sections that automatically appear on the public website with custom headings, subtitles, cards, and bullet points.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const newSec: WebsiteCustomSection = {
                      id: `csec-${Date.now()}`,
                      heading: 'New Custom Website Section',
                      subtitle: 'Introduce additional modules, partnerships, or hospitality highlights.',
                      items: [
                        {
                          id: `citem-${Date.now()}-1`,
                          title: 'Highlight Card One',
                          description: 'Describe your custom feature, service, or announcement here.',
                          badgeText: 'Featured',
                          bullets: ['Key benefit one', 'Key benefit two']
                        }
                      ]
                    };
                    updateCmsField('customSections', [...customSections, newSec]);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 text-xs font-bold shadow-sm cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add New Website Section
                </button>
              </div>

              {customSections.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-luxury-brown-200 space-y-2">
                  <p className="text-sm font-serif font-bold text-luxury-brown-800">No extra custom sections added yet.</p>
                  <p className="text-xs text-luxury-brown-500">
                    Click &ldquo;+ Add New Website Section&rdquo; above to insert a new custom section onto the public website.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {customSections.map((sec, sIdx) => (
                    <div key={sec.id || sIdx} className="p-5 bg-white rounded-2xl border border-luxury-brown-200 space-y-4 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-luxury-brown-100">
                        <span className="text-xs font-mono uppercase font-bold text-luxury-gold-600">
                          Custom Section #{sIdx + 1}: {sec.heading}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...customSections];
                              const nextItems: WebsiteCustomSectionItem[] = [
                                ...(sec.items || []),
                                {
                                  id: `citem-${Date.now()}`,
                                  title: 'New Section Card',
                                  description: 'Card description text.',
                                  badgeText: '',
                                  bullets: ['Point 1']
                                }
                              ];
                              next[sIdx] = { ...sec, items: nextItems };
                              updateCmsField('customSections', next);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-luxury-brown-900 text-white text-xs font-bold cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Card to Section
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCmsField('customSections', customSections.filter((_, i) => i !== sIdx))}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove Section
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-luxury-brown-700 block">Section Heading</label>
                          <input
                            type="text"
                            value={sec.heading}
                            onChange={(e) => {
                              const next = [...customSections];
                              next[sIdx] = { ...sec, heading: e.target.value };
                              updateCmsField('customSections', next);
                            }}
                            className="w-full text-sm bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950 font-serif font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-luxury-brown-700 block">Section Subtitle</label>
                          <input
                            type="text"
                            value={sec.subtitle}
                            onChange={(e) => {
                              const next = [...customSections];
                              next[sIdx] = { ...sec, subtitle: e.target.value };
                              updateCmsField('customSections', next);
                            }}
                            className="w-full text-sm bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-xl px-3.5 py-2 text-luxury-brown-950"
                          />
                        </div>
                      </div>

                      {/* Cards inside this Custom Section */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        {(sec.items || []).map((item, iIdx) => (
                          <div key={item.id || iIdx} className="p-3.5 bg-luxury-beige-50/40 rounded-xl border border-luxury-brown-100 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono uppercase text-luxury-brown-600 font-bold">Card #{iIdx + 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...customSections];
                                  next[sIdx] = {
                                    ...sec,
                                    items: (sec.items || []).filter((_, idx) => idx !== iIdx)
                                  };
                                  updateCmsField('customSections', next);
                                }}
                                className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => {
                                const nextItems = [...(sec.items || [])];
                                nextItems[iIdx] = { ...item, title: e.target.value };
                                const next = [...customSections];
                                next[sIdx] = { ...sec, items: nextItems };
                                updateCmsField('customSections', next);
                              }}
                              placeholder="Card Title"
                              className="w-full text-xs font-bold bg-white border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-950"
                            />

                            <input
                              type="text"
                              value={item.badgeText || ''}
                              onChange={(e) => {
                                const nextItems = [...(sec.items || [])];
                                nextItems[iIdx] = { ...item, badgeText: e.target.value };
                                const next = [...customSections];
                                next[sIdx] = { ...sec, items: nextItems };
                                updateCmsField('customSections', next);
                              }}
                              placeholder="Optional Badge (e.g. New / 24x7)"
                              className="w-full text-xs font-mono bg-white border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-gold-600"
                            />

                            <textarea
                              rows={2}
                              value={item.description}
                              onChange={(e) => {
                                const nextItems = [...(sec.items || [])];
                                nextItems[iIdx] = { ...item, description: e.target.value };
                                const next = [...customSections];
                                next[sIdx] = { ...sec, items: nextItems };
                                updateCmsField('customSections', next);
                              }}
                              placeholder="Card Description"
                              className="w-full text-xs bg-white border border-luxury-brown-100 rounded-lg px-2.5 py-1.5 text-luxury-brown-800 resize-none"
                            />

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold text-luxury-brown-600">Bullet Points</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextItems = [...(sec.items || [])];
                                    nextItems[iIdx] = {
                                      ...item,
                                      bullets: [...(item.bullets || []), 'New Point']
                                    };
                                    const next = [...customSections];
                                    next[sIdx] = { ...sec, items: nextItems };
                                    updateCmsField('customSections', next);
                                  }}
                                  className="text-[10px] font-bold text-luxury-gold-600 hover:underline cursor-pointer"
                                >
                                  + Add Point
                                </button>
                              </div>
                              {(item.bullets || []).map((bp, bpIdx) => (
                                <div key={bpIdx} className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={bp}
                                    onChange={(e) => {
                                      const nextBullets = [...(item.bullets || [])];
                                      nextBullets[bpIdx] = e.target.value;
                                      const nextItems = [...(sec.items || [])];
                                      nextItems[iIdx] = { ...item, bullets: nextBullets };
                                      const next = [...customSections];
                                      next[sIdx] = { ...sec, items: nextItems };
                                      updateCmsField('customSections', next);
                                    }}
                                    className="flex-1 text-xs bg-white border border-luxury-brown-100 rounded-lg px-2 py-1 text-luxury-brown-900"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextBullets = (item.bullets || []).filter((_, idx) => idx !== bpIdx);
                                      const nextItems = [...(sec.items || [])];
                                      nextItems[iIdx] = { ...item, bullets: nextBullets };
                                      const next = [...customSections];
                                      next[sIdx] = { ...sec, items: nextItems };
                                      updateCmsField('customSections', next);
                                    }}
                                    className="text-rose-500 p-0.5 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Sticky Save Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-luxury-brown-100">
              <p className="text-xs text-luxury-brown-500">
                Changes made above will immediately reflect on the live Public Website once saved.
              </p>
              <button
                type="button"
                onClick={handleSaveWebsiteCms}
                className="inline-flex items-center gap-2 py-3 px-8 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow-md transition-all duration-200 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save All Website Changes</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* CUSTOM PAGES & LINKS CMS SECTION */}
      {activeSubTab === 'pages' && (() => {
        const filteredPages = customPagesList.filter(p => {
          const query = pageSearch.toLowerCase();
          return p.title.toLowerCase().includes(query) ||
            p.slug.toLowerCase().includes(query) ||
            p.content.toLowerCase().includes(query);
        });

        return (
          <div className="space-y-6 animate-fade-in pt-2">
            {/* Page Toast Notification */}
            {pageToast && (
              <div className="bg-emerald-900 text-emerald-100 px-4 py-3 rounded-xl shadow-lg border border-emerald-500/30 flex items-center justify-between text-xs font-semibold animate-fade-in my-2">
                <span>{pageToast}</span>
                <button onClick={() => setPageToast(null)} className="text-emerald-300 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Header Card */}
            <div className="bg-gradient-to-br from-luxury-brown-900 via-luxury-brown-950 to-black text-white p-6 rounded-2xl border border-luxury-gold-500/20 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-luxury-gold-500/20 text-luxury-gold-300 border border-luxury-gold-500/20 text-[10px] font-mono uppercase font-bold tracking-wider">
                  <FileText className="w-3.5 h-3.5 text-luxury-gold-400" /> Super Admin Page Builder & Link Manager
                </div>
                <h2 className="text-2xl font-serif font-bold text-white">Custom Web Pages & Banners</h2>
                <p className="text-xs text-luxury-brown-200 max-w-2xl">
                  Easily create custom pages with custom titles, links, text content, and banner images. Added pages can be viewed directly or shared with your hotel partners and website visitors.
                </p>
              </div>

              <button
                onClick={handleOpenAddPage}
                className="inline-flex items-center gap-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold px-4 py-2.5 rounded-xl shadow-md transition-all text-xs cursor-pointer whitespace-nowrap hover:scale-102 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add New Page
              </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-luxury-brown-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-luxury-brown-400" />
                <input
                  type="text"
                  placeholder="Search pages by title, link or keyword..."
                  value={pageSearch}
                  onChange={(e) => setPageSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs font-sans focus:outline-none focus:border-luxury-gold-500"
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-luxury-brown-600">
                <span className="px-2.5 py-1 bg-luxury-beige-100 rounded-lg border border-luxury-brown-200 font-bold">
                  Total Pages: {customPagesList.length}
                </span>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-bold">
                  Published: {customPagesList.filter(p => p.published).length}
                </span>
              </div>
            </div>

            {/* Pages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPages.length === 0 ? (
                <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-luxury-brown-100 space-y-3">
                  <FileText className="w-10 h-10 text-luxury-brown-300 mx-auto" />
                  <p className="text-sm font-serif text-luxury-brown-700 font-bold">No custom pages found.</p>
                  <p className="text-xs text-luxury-brown-400">Click "Add New Page" to publish custom text, image, and link pages.</p>
                  <button
                    onClick={handleOpenAddPage}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-luxury-brown-900 text-luxury-gold-300 rounded-xl text-xs font-bold hover:bg-black cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add First Custom Page
                  </button>
                </div>
              ) : (
                filteredPages.map(page => (
                  <div key={page.id} className="bg-white rounded-2xl border border-luxury-brown-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow group">
                    <div>
                      {/* Image Preview / Header */}
                      <div className="relative h-40 bg-luxury-brown-900 overflow-hidden">
                        {page.imageUrl ? (
                          <img
                            src={page.imageUrl}
                            alt={page.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-luxury-brown-900 to-luxury-brown-950 text-luxury-gold-400 p-4 text-center">
                            <FileText className="w-10 h-10 opacity-40 mb-1" />
                            <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-gold-300/80">Page Document</span>
                          </div>
                        )}
                        <div className="absolute top-3 right-3">
                          <button
                            onClick={() => handleTogglePublishPage(page.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border shadow-sm cursor-pointer transition-all ${
                              page.published 
                                ? 'bg-emerald-500 text-white border-emerald-400' 
                                : 'bg-amber-500 text-white border-amber-400'
                            }`}
                            title="Click to toggle Draft / Published status"
                          >
                            {page.published ? 'Published' : 'Draft'}
                          </button>
                        </div>
                      </div>

                      {/* Content Info */}
                      <div className="p-5 space-y-3">
                        <div className="space-y-1">
                          <h3 className="font-serif font-bold text-base text-luxury-brown-950 line-clamp-1">{page.title}</h3>
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-luxury-gold-700 bg-luxury-beige-100/70 px-2.5 py-1 rounded-lg border border-luxury-gold-300/40 w-fit">
                            <Link className="w-3 h-3 text-luxury-gold-600" />
                            <span className="truncate max-w-[200px]">/page/{page.slug}</span>
                          </div>
                        </div>

                        <p className="text-xs text-luxury-brown-600 line-clamp-3 leading-relaxed">
                          {page.content || 'No text content provided.'}
                        </p>

                        {page.linkUrl && (
                          <a
                            href={page.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-luxury-gold-800 hover:text-luxury-brown-950 underline decoration-luxury-gold-400 underline-offset-2"
                          >
                            <span>{page.linkText || 'External Link'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="p-4 bg-luxury-beige-50/60 border-t border-luxury-brown-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setViewingPage(page)}
                        className="px-3 py-1.5 bg-white border border-luxury-brown-200 hover:bg-luxury-beige-100 text-luxury-brown-900 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Eye className="w-3.5 h-3.5 text-luxury-gold-600" /> Preview
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditPage(page)}
                          className="p-1.5 bg-white border border-luxury-brown-200 hover:bg-luxury-beige-100 text-luxury-brown-800 rounded-lg text-xs cursor-pointer transition-all"
                          title="Edit Page"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePage(page.id, page.title)}
                          className="p-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-xs cursor-pointer transition-all"
                          title="Delete Page"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ADD / EDIT CUSTOM PAGE MODAL */}
            {showPageModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
                <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in my-8 max-h-[90vh] flex flex-col">
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 flex justify-between items-center border-b border-luxury-gold-500/10 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-5 h-5 text-luxury-gold-400" />
                      <h3 className="font-serif font-bold text-lg">
                        {editingPageId ? 'Edit Custom Page' : 'Add New Custom Page'}
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowPageModal(false)}
                      className="p-1.5 hover:bg-luxury-brown-800 rounded-lg text-luxury-brown-300 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Form Body */}
                  <form onSubmit={handleSavePage} className="p-6 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="font-mono text-xs uppercase font-bold text-luxury-brown-800 block">Page Title *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Special Offer or Terms of Service"
                          value={pageTitle}
                          onChange={(e) => setPageTitle(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-luxury-brown-200 rounded-xl text-xs font-sans bg-white focus:outline-none focus:border-luxury-gold-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono text-xs uppercase font-bold text-luxury-brown-800 block">Link Slug / URL Name</label>
                        <input
                          type="text"
                          placeholder="e.g. special-offer or pricing"
                          value={pageSlug}
                          onChange={(e) => setPageSlug(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-luxury-brown-200 rounded-xl text-xs font-mono bg-white focus:outline-none focus:border-luxury-gold-500"
                        />
                        <p className="text-[10px] text-luxury-brown-400">Unique URL link e.g. /page/{pageSlug || 'your-title'}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-xs uppercase font-bold text-luxury-brown-800 block">Text Content & Description</label>
                      <textarea
                        rows={4}
                        placeholder="Enter full page body text, announcements, or terms description..."
                        value={pageContent}
                        onChange={(e) => setPageContent(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-luxury-brown-200 rounded-xl text-xs font-sans bg-white focus:outline-none focus:border-luxury-gold-500 leading-relaxed"
                      />
                    </div>

                    {/* Image URL & Upload */}
                    <div className="space-y-2 border-t border-luxury-brown-100 pt-3">
                      <label className="font-mono text-xs uppercase font-bold text-luxury-brown-800 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-luxury-gold-600" /> Featured Image (Banner)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            placeholder="https://images.unsplash.com/... or paste image URL"
                            value={pageImageUrl}
                            onChange={(e) => setPageImageUrl(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-luxury-brown-200 rounded-xl text-xs font-sans bg-white focus:outline-none focus:border-luxury-gold-500"
                          />
                        </div>
                        <div>
                          <label className="w-full px-3 py-2.5 bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-950 font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1 border border-luxury-brown-300">
                            <span>Upload Image File</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handlePageImageFileUpload(e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      {pageImageUrl && (
                        <div className="relative w-full h-32 rounded-xl overflow-hidden border border-luxury-brown-200 bg-black">
                          <img src={pageImageUrl} alt="Preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setPageImageUrl('')}
                            className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded-full hover:bg-rose-600 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Button Link */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-luxury-brown-100 pt-3">
                      <div className="space-y-1">
                        <label className="font-mono text-xs uppercase font-bold text-luxury-brown-800 block">Button Link Target URL (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. https://directstay.in/book"
                          value={pageLinkUrl}
                          onChange={(e) => setPageLinkUrl(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-luxury-brown-200 rounded-xl text-xs font-mono bg-white focus:outline-none focus:border-luxury-gold-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono text-xs uppercase font-bold text-luxury-brown-800 block">Link Button Text</label>
                        <input
                          type="text"
                          placeholder="e.g. Claim Offer or Visit Page"
                          value={pageLinkText}
                          onChange={(e) => setPageLinkText(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-luxury-brown-200 rounded-xl text-xs font-sans bg-white focus:outline-none focus:border-luxury-gold-500"
                        />
                      </div>
                    </div>

                    {/* Publish Toggle */}
                    <div className="flex items-center justify-between p-3.5 bg-luxury-beige-50 rounded-2xl border border-luxury-brown-100">
                      <div>
                        <span className="font-serif font-bold text-xs text-luxury-brown-950 block">Publish Page Status</span>
                        <span className="text-[10px] text-luxury-brown-500 font-mono">
                          {pagePublished ? 'Visible publicly on custom page routes and web link' : 'Saved as draft (hidden from public view)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPagePublished(!pagePublished)}
                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          pagePublished ? 'bg-emerald-500 justify-end' : 'bg-luxury-brown-300 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                      </button>
                    </div>

                    {/* Modal Action Buttons */}
                    <div className="pt-4 flex justify-end gap-3 border-t border-luxury-brown-100 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowPageModal(false)}
                        className="px-4 py-2.5 border border-luxury-brown-200 text-luxury-brown-700 rounded-xl text-xs hover:bg-luxury-beige-50 cursor-pointer font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-serif font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Save className="w-4 h-4" /> Save & Publish Page
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* VIEW PREVIEW PAGE MODAL */}
            {viewingPage && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
                <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-3xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
                  <div className="relative h-56 bg-luxury-brown-950 shrink-0">
                    {viewingPage.imageUrl ? (
                      <img src={viewingPage.imageUrl} alt={viewingPage.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-luxury-gold-400 p-6">
                        <FileText className="w-12 h-12 opacity-30 mb-2" />
                        <span className="font-serif font-bold text-xl">{viewingPage.title}</span>
                      </div>
                    )}
                    <button
                      onClick={() => setViewingPage(null)}
                      className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white p-2 rounded-full cursor-pointer transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-8 space-y-6 overflow-y-auto">
                    <div className="space-y-2 border-b border-luxury-brown-100 pb-4">
                      <div className="flex items-center justify-between gap-4">
                        <h2 className="text-2xl font-serif font-bold text-luxury-brown-950">{viewingPage.title}</h2>
                        <span className="px-2.5 py-1 bg-luxury-gold-50 text-luxury-gold-800 border border-luxury-gold-300 rounded-lg text-xs font-mono font-bold">
                          /page/{viewingPage.slug}
                        </span>
                      </div>
                      {viewingPage.createdAt && (
                        <p className="text-xs text-luxury-brown-400 font-mono">Published Date: {viewingPage.createdAt}</p>
                      )}
                    </div>

                    <div className="prose text-sm text-luxury-brown-800 leading-relaxed space-y-4 whitespace-pre-wrap">
                      {viewingPage.content}
                    </div>

                    {viewingPage.linkUrl && (
                      <div className="pt-4 border-t border-luxury-brown-100 flex justify-start">
                        <a
                          href={viewingPage.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-6 py-3 bg-luxury-brown-900 hover:bg-black text-luxury-gold-300 font-bold rounded-xl text-xs inline-flex items-center gap-2 shadow-md"
                        >
                          <span>{viewingPage.linkText || 'Open External Link'}</span>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-luxury-beige-50 border-t border-luxury-brown-100 flex justify-end shrink-0">
                    <button
                      onClick={() => setViewingPage(null)}
                      className="px-5 py-2 bg-luxury-brown-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Close Preview
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* USER MANAGEMENT SECTION */}
      {activeSubTab === 'users' && (() => {
        const hotelAdminUsers: HotelAdminUser[] = hotels.map(h => ({
          id: `USR-${h.id}`,
          name: h.ownerName || `${h.name} Admin`,
          username: h.username || 'admin',
          password: h.password,
          email: h.emailAddress || 'admin@hotel.com',
          mobile: h.phoneNumber || 'N/A',
          hotelId: h.id,
          hotelName: h.name,
          status: (h.status as any) || 'Approved',
          role: 'Hotel Admin'
        }));

        const allUsers = [...hotelAdminUsers, ...standaloneUsers];

        const filteredUsers = allUsers.filter(u => {
          const searchLower = userSearch.toLowerCase();
          const matchesSearch = 
            u.name.toLowerCase().includes(searchLower) ||
            u.username.toLowerCase().includes(searchLower) ||
            u.email.toLowerCase().includes(searchLower) ||
            u.hotelName.toLowerCase().includes(searchLower);

          if (!matchesSearch) return false;

          if (userFilter === 'Assigned') return !!u.hotelId && u.hotelId !== 'unassigned';
          if (userFilter === 'Unassigned') return !u.hotelId || u.hotelId === 'unassigned';
          if (userFilter === 'Approved') return u.status === 'Approved' || u.status === 'Active';
          if (userFilter === 'Pending') return u.status === 'Pending';
          return true;
        });

        const assignedCount = allUsers.filter(u => u.hotelId && u.hotelId !== 'unassigned').length;
        const unassignedCount = allUsers.filter(u => !u.hotelId || u.hotelId === 'unassigned').length;
        const activeHotelsCovered = hotels.filter(h => h.username && h.status === 'Approved').length;

        const handleConfirmAssignHotel = () => {
          if (!assignModalUser) return;
          const targetHotelId = selectedAssignHotelId;
          const targetHotel = hotels.find(h => h.id === targetHotelId);

          const updatedHotels = hotels.map(h => {
            if (h.id === targetHotelId) {
              const assignedPass = assignModalUser.password
                ? ensurePasswordHash(assignModalUser.password, h.password)
                : h.password;
              return {
                ...h,
                username: assignModalUser.username,
                password: assignedPass,
                ownerPassword: assignModalUser.password ? assignedPass : h.ownerPassword,
                ownerName: assignModalUser.name,
                emailAddress: assignModalUser.email || h.emailAddress,
                phoneNumber: assignModalUser.mobile || h.phoneNumber
              };
            }
            if (h.username === assignModalUser.username && h.id !== targetHotelId) {
              return {
                ...h,
                username: `admin_${h.id.substring(0, 8)}`
              };
            }
            return h;
          });

          updateStandaloneUsers(prev => prev.map(u => {
            if (u.id === assignModalUser.id) {
              return {
                ...u,
                hotelId: targetHotelId || null,
                hotelName: targetHotel ? targetHotel.name : 'Unassigned'
              };
            }
            return u;
          }));

          if (onUpdateHotels) {
            onUpdateHotels(updatedHotels);
          }

          setUserActionToast(`✓ Successfully assigned user "${assignModalUser.name}" (@${assignModalUser.username}) to ${targetHotel ? targetHotel.name : 'Unassigned'}!`);
          setAssignModalUser(null);
          setSelectedAssignHotelId('');
        };

        const handleToggleUserStatus = (user: HotelAdminUser) => {
          const isCurrentlyActive = user.status === 'Approved' || user.status === 'Active';
          const nextStatus: 'Approved' | 'Suspended' = isCurrentlyActive ? 'Suspended' : 'Approved';
          if (user.hotelId && user.hotelId !== 'unassigned') {
            handleUpdateStatus(user.hotelId, nextStatus);
          } else {
            updateStandaloneUsers(prev =>
              prev.map(u => (u.id === user.id ? { ...u, status: nextStatus } : u))
            );
            setUserActionToast(`✓ User "${user.name}" (@${user.username}) status changed to ${nextStatus}.`);
            setTimeout(() => setUserActionToast(null), 4000);
          }
        };

        const handleSaveEditUser = (e: React.FormEvent) => {
          e.preventDefault();
          if (!editingUser) return;
          if (!editingUser.name.trim() || !editingUser.username.trim()) {
            showToast('Full name and username are required.', 'warning');
            return;
          }

          const newPassTrimmed = editUserNewPassword.trim();

          if (editingUser.hotelId) {
            const updatedHotels = hotels.map(h => {
              if (h.id === editingUser.hotelId) {
                const nextPass = newPassTrimmed ? ensurePasswordHash(newPassTrimmed, h.password) : h.password;
                const nextOwnerPass = newPassTrimmed ? ensurePasswordHash(newPassTrimmed, h.ownerPassword) : h.ownerPassword;
                return {
                  ...h,
                  ownerName: editingUser.name.trim(),
                  username: editingUser.username.trim(),
                  password: nextPass,
                  ownerPassword: nextOwnerPass,
                  emailAddress: editingUser.email.trim(),
                  phoneNumber: editingUser.mobile.trim()
                };
              }
              return h;
            });
            if (onUpdateHotels) {
              onUpdateHotels(updatedHotels);
            }
          } else {
            updateStandaloneUsers(prev =>
              prev.map(u =>
                u.id === editingUser.id
                  ? {
                      ...editingUser,
                      name: editingUser.name.trim(),
                      username: editingUser.username.trim(),
                      password: newPassTrimmed ? ensurePasswordHash(newPassTrimmed, u.password) : u.password
                    }
                  : u
              )
            );
          }

          setUserActionToast(`✓ Updated credentials for user "${editingUser.name}" (@${editingUser.username})`);
          setEditingUser(null);
          setEditUserNewPassword('');
        };

        return (
          <div className="space-y-6 animate-fade-in" id="saas-users-tab">
            {/* Top Notification Toast */}
            {userActionToast && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs p-3.5 rounded-2xl flex items-center justify-between shadow-xs animate-fade-in font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{userActionToast}</span>
                </div>
                <button 
                  onClick={() => setUserActionToast(null)} 
                  className="text-emerald-700 hover:text-emerald-950 font-bold text-xs cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Header & Primary Action */}
            <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-luxury-gold-600 mb-1">
                  <UserCog className="w-4 h-4" />
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">User Authority & Hotel Assignment</span>
                </div>
                <h2 className="text-2xl font-serif font-bold text-luxury-brown-950">Hotel Admin Users Management</h2>
                <p className="text-luxury-brown-500 text-xs mt-1">
                  View, edit, activate/suspend, or assign any Hotel Admin user account to registered hotel properties.
                </p>
              </div>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="px-5 py-3 rounded-2xl bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-300 font-serif font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-luxury-gold-400" />
                <span>Add New Hotel Admin User</span>
              </button>
            </div>

            {/* Stats Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500">Total Admin Users</span>
                  <div className="p-2 bg-luxury-beige-100 text-luxury-brown-800 rounded-xl">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-serif font-bold text-luxury-brown-950 block">{allUsers.length}</span>
                <span className="text-[10px] text-luxury-brown-400 font-sans mt-0.5 block">Registered user accounts</span>
              </div>

              <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500">Assigned To Hotel</span>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-serif font-bold text-emerald-700 block">{assignedCount}</span>
                <span className="text-[10px] text-emerald-600/80 font-sans mt-0.5 block">Active property assignments</span>
              </div>

              <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500">Unassigned Users</span>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <UserX className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-serif font-bold text-amber-600 block">{unassignedCount}</span>
                <span className="text-[10px] text-amber-600/80 font-sans mt-0.5 block">Pending property assignment</span>
              </div>

              <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500">Active Hotels Covered</span>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Building className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-serif font-bold text-blue-700 block">{activeHotelsCovered}</span>
                <span className="text-[10px] text-blue-600/80 font-sans mt-0.5 block">Approved hotels with admin</span>
              </div>
            </div>

            {/* Search & Filter bar */}
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-luxury-brown-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, username, email, hotel..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-luxury-beige-50/50 border border-luxury-brown-200 rounded-xl text-xs font-sans focus:outline-none focus:border-luxury-gold-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                {(['All', 'Assigned', 'Unassigned', 'Approved', 'Pending'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setUserFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      userFilter === f
                        ? 'bg-luxury-brown-950 text-luxury-gold-300 shadow-xs'
                        : 'bg-luxury-beige-100 text-luxury-brown-600 hover:bg-luxury-beige-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-luxury-brown-100 rounded-3xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-luxury-beige-100/60 border-b border-luxury-brown-100 font-mono text-[10px] uppercase text-luxury-brown-600 font-bold">
                    <tr>
                      <th className="py-3.5 px-4">User Details</th>
                      <th className="py-3.5 px-4">Contact Info</th>
                      <th className="py-3.5 px-4">Assigned Hotel</th>
                      <th className="py-3.5 px-4">Security Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-100/60 text-luxury-brown-900">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-luxury-brown-400 font-mono">
                          No hotel admin users found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(user => {
                        const isAssigned = !!user.hotelId && user.hotelId !== 'unassigned';
                        const isUserActive = user.status === 'Approved' || user.status === 'Active';

                        return (
                          <tr key={user.id} className="hover:bg-luxury-beige-50/40 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-luxury-brown-950 text-luxury-gold-300 font-serif font-bold text-sm flex items-center justify-center border border-luxury-gold-500/20 shadow-xs">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-serif font-bold text-sm text-luxury-brown-950">{user.name}</div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="font-mono text-[10px] text-luxury-brown-500">@{user.username}</span>
                                    <span className="px-1.5 py-0.5 bg-luxury-gold-50 text-luxury-gold-800 border border-luxury-gold-200/60 text-[9px] rounded font-mono font-medium">
                                      {user.role}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono text-[11px] text-luxury-brown-700">
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3 h-3 text-luxury-brown-400" />
                                <span>{user.email}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 text-luxury-brown-500">
                                <Phone className="w-3 h-3 text-luxury-brown-400" />
                                <span>{user.mobile}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              {isAssigned ? (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <Building className="w-3.5 h-3.5 text-luxury-gold-600 shrink-0" />
                                    <button
                                      type="button"
                                      onClick={() => user.hotelId && handleImpersonate(user.hotelId)}
                                      className="font-serif font-bold text-xs text-luxury-brown-950 hover:text-luxury-gold-600 hover:underline transition-colors cursor-pointer text-left"
                                      title="Open Hotel PMS Core Operations"
                                    >
                                      {user.hotelName}
                                    </button>
                                    {user.hotelId && (
                                      <button
                                        type="button"
                                        onClick={() => handleImpersonate(user.hotelId!)}
                                        className="p-1 hover:bg-luxury-gold-100 rounded text-luxury-gold-700 transition-colors cursor-pointer"
                                        title="Open Hotel PMS Core Operations"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                                    isUserActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}>
                                    {user.status}
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-1.5 text-amber-600 font-mono text-xs">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Unassigned</span>
                                  </div>
                                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                                    isUserActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {user.status}
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 font-mono text-xs">
                              <div className="inline-flex items-center gap-1.5 bg-luxury-beige-100/80 px-2.5 py-1 rounded-lg text-luxury-brown-700 font-semibold border border-luxury-brown-200/70 text-[11px]">
                                <Lock className="w-3 h-3 text-luxury-gold-600" />
                                <span>•••••••• (SHA-256)</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isAssigned && user.hotelId && (
                                  <button
                                    type="button"
                                    onClick={() => handleImpersonate(user.hotelId!)}
                                    className="px-2.5 py-1.5 rounded-xl border border-luxury-gold-500/60 bg-gradient-to-r from-luxury-gold-500 to-luxury-gold-400 hover:from-luxury-gold-400 hover:to-luxury-gold-300 text-luxury-brown-950 transition-all cursor-pointer flex items-center gap-1.5 font-bold text-xs shadow-xs"
                                    title="Open Hotel PMS in New Tab"
                                  >
                                    <Building className="w-3.5 h-3.5" />
                                    <span>Open PMS</span>
                                    <ExternalLink className="w-3 h-3 text-luxury-brown-950" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleToggleUserStatus(user)}
                                  className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer border ${
                                    isUserActive
                                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                  }`}
                                  title={isUserActive ? 'Suspend Account' : 'Activate Account'}
                                >
                                  {isUserActive ? 'Suspend' : 'Activate'}
                                </button>
                                <button
                                  onClick={() => {
                                    setAssignModalUser(user);
                                    setSelectedAssignHotelId(user.hotelId || '');
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Link className="w-3 h-3" />
                                  <span>{isAssigned ? 'Reassign Hotel' : 'Assign Hotel'}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingUser(user);
                                    setEditUserNewPassword('');
                                  }}
                                  className="p-1.5 rounded-lg border border-luxury-brown-200 text-luxury-brown-700 hover:bg-luxury-beige-100 transition-colors cursor-pointer"
                                  title="Edit User Credentials"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Assign Hotel Modal */}
            {assignModalUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
                <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
                  <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 flex justify-between items-center border-b border-luxury-gold-500/10">
                    <div className="flex items-center gap-2">
                      <Link className="w-5 h-5 text-luxury-gold-400" />
                      <h3 className="font-serif font-bold text-lg">Assign User to Hotel</h3>
                    </div>
                    <button 
                      onClick={() => setAssignModalUser(null)}
                      className="p-1.5 hover:bg-luxury-brown-800 rounded-lg text-luxury-brown-300 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="bg-luxury-beige-50 border border-luxury-brown-100 p-4 rounded-2xl space-y-1">
                      <div className="font-serif font-bold text-luxury-brown-950 text-base">{assignModalUser.name}</div>
                      <div className="font-mono text-xs text-luxury-brown-500">Username: @{assignModalUser.username} | Email: {assignModalUser.email}</div>
                    </div>

                    <div className="space-y-2">
                      <label className="font-mono text-xs uppercase font-bold text-luxury-brown-700 block">Select Target Hotel Property *</label>
                      <select
                        value={selectedAssignHotelId}
                        onChange={(e) => setSelectedAssignHotelId(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-luxury-brown-200 rounded-xl text-xs font-sans bg-white focus:outline-none focus:border-luxury-gold-500"
                      >
                        <option value="">-- Unassigned (No Hotel Property) --</option>
                        {hotels.map(h => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.status}) - Current Admin: @{h.username || 'none'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <p className="text-[11px] text-luxury-brown-500 italic leading-relaxed">
                      Assigning this user will set their credentials (@{assignModalUser.username}) as the primary admin login for the selected hotel property.
                    </p>

                    <div className="pt-3 flex justify-end gap-3 border-t border-luxury-brown-100">
                      <button
                        type="button"
                        onClick={() => setAssignModalUser(null)}
                        className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 rounded-xl text-xs hover:bg-luxury-beige-50 cursor-pointer font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmAssignHotel}
                        className="px-5 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-serif font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        Confirm & Link Hotel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Add New Hotel Admin User Modal */}
            {showAddUserModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
                <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
                  <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 flex justify-between items-center border-b border-luxury-gold-500/10">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-luxury-gold-400" />
                      <h3 className="font-serif font-bold text-lg">Add New Hotel Admin User</h3>
                    </div>
                    <button 
                      onClick={() => setShowAddUserModal(false)}
                      className="p-1.5 hover:bg-luxury-brown-800 rounded-lg text-luxury-brown-300 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!newUserForm.username.trim() || !newUserForm.name.trim()) {
                      showToast('Full name and username are required.', 'warning');
                      return;
                    }

                    const targetHotel = hotels.find(h => h.id === newUserForm.hotelId);
                    const hashedPass = ensurePasswordHash(newUserForm.password || 'password123');

                    if (newUserForm.hotelId && targetHotel) {
                      const updatedHotels = hotels.map(h => {
                        if (h.id === newUserForm.hotelId) {
                          return {
                            ...h,
                            ownerName: newUserForm.name.trim(),
                            username: newUserForm.username.trim(),
                            password: hashedPass,
                            emailAddress: newUserForm.email.trim() || h.emailAddress,
                            phoneNumber: newUserForm.mobile.trim() || h.phoneNumber
                          };
                        }
                        return h;
                      });
                      if (onUpdateHotels) {
                        onUpdateHotels(updatedHotels);
                      }
                    } else {
                      updateStandaloneUsers(prev => [
                        ...prev,
                        {
                          id: `USR-${Date.now()}`,
                          name: newUserForm.name.trim(),
                          username: newUserForm.username.trim(),
                          password: hashedPass,
                          email: newUserForm.email.trim() || 'admin@hotel.com',
                          mobile: newUserForm.mobile.trim() || 'N/A',
                          hotelId: null,
                          hotelName: 'Unassigned',
                          status: 'Approved',
                          role: 'Hotel Admin'
                        }
                      ]);
                    }

                    setUserActionToast(`✓ New Hotel Admin "${newUserForm.name}" created and assigned to ${targetHotel ? targetHotel.name : 'Unassigned'}!`);
                    setShowAddUserModal(false);
                    setNewUserForm({ name: '', username: '', password: '', email: '', mobile: '', hotelId: '' });
                  }} className="p-6 space-y-4">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="font-mono text-xs uppercase font-bold text-luxury-brown-700">Full Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Ramesh Chandra"
                          value={newUserForm.name}
                          onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:outline-none focus:border-luxury-gold-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono text-xs uppercase font-bold text-luxury-brown-700">Username *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. ramesh_admin"
                          value={newUserForm.username}
                          onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-mono focus:outline-none focus:border-luxury-gold-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="font-mono text-xs uppercase font-bold text-luxury-brown-700">Initial Password *</label>
                        <input
                          type="password"
                          required
                          placeholder="Enter initial password"
                          value={newUserForm.password}
                          onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-mono focus:outline-none focus:border-luxury-gold-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono text-xs uppercase font-bold text-luxury-brown-700">Email Address</label>
                        <input
                          type="email"
                          placeholder="ramesh@hotel.com"
                          value={newUserForm.email}
                          onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:outline-none focus:border-luxury-gold-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="font-mono text-xs uppercase font-bold text-luxury-brown-700">Mobile Phone</label>
                        <input
                          type="text"
                          placeholder="+91 98765 43210"
                          value={newUserForm.mobile}
                          onChange={(e) => setNewUserForm({ ...newUserForm, mobile: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-mono focus:outline-none focus:border-luxury-gold-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono text-xs uppercase font-bold text-luxury-brown-700">Assign To Hotel</label>
                        <select
                          value={newUserForm.hotelId}
                          onChange={(e) => setNewUserForm({ ...newUserForm, hotelId: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:outline-none focus:border-luxury-gold-500"
                        >
                          <option value="">-- Unassigned (Leave Standalone) --</option>
                          {hotels.map(h => (
                            <option key={h.id} value={h.id}>
                              {h.name} ({h.status})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-3 flex justify-end gap-3 border-t border-luxury-brown-100">
                      <button
                        type="button"
                        onClick={() => setShowAddUserModal(false)}
                        className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 rounded-xl text-xs hover:bg-luxury-beige-50 cursor-pointer font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-300 font-serif font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        Create & Assign User
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Edit User Credentials Modal */}
            {editingUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
                <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                  <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 flex justify-between items-center border-b border-luxury-gold-500/10">
                    <div className="flex items-center gap-2">
                      <Edit className="w-5 h-5 text-luxury-gold-400" />
                      <h3 className="font-serif font-bold text-lg">Edit User Credentials</h3>
                    </div>
                    <button 
                      onClick={() => {
                        setEditingUser(null);
                        setEditUserNewPassword('');
                      }}
                      className="p-1.5 hover:bg-luxury-brown-800 rounded-lg text-luxury-brown-300 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveEditUser} className="p-6 space-y-4">
                    <div className="space-y-1">
                      <label className="font-mono text-xs uppercase font-bold text-luxury-brown-700">Full Name</label>
                      <input
                        type="text"
                        required
                        value={editingUser.name}
                        onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:outline-none focus:border-luxury-gold-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-xs uppercase font-bold text-luxury-brown-700">Username</label>
                      <input
                        type="text"
                        required
                        value={editingUser.username}
                        onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-mono focus:outline-none focus:border-luxury-gold-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-xs uppercase font-bold text-luxury-brown-700">New Password (Optional)</label>
                      <input
                        type="password"
                        placeholder="Leave blank to keep existing password"
                        value={editUserNewPassword}
                        onChange={(e) => setEditUserNewPassword(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-mono focus:outline-none focus:border-luxury-gold-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-xs uppercase font-bold text-luxury-brown-700">Email Address</label>
                      <input
                        type="email"
                        value={editingUser.email}
                        onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:outline-none focus:border-luxury-gold-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-xs uppercase font-bold text-luxury-brown-700">Mobile Phone</label>
                      <input
                        type="text"
                        value={editingUser.mobile}
                        onChange={(e) => setEditingUser({ ...editingUser, mobile: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-mono focus:outline-none focus:border-luxury-gold-500"
                      />
                    </div>

                    <div className="pt-3 flex justify-end gap-3 border-t border-luxury-brown-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUser(null);
                          setEditUserNewPassword('');
                        }}
                        className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 rounded-xl text-xs hover:bg-luxury-beige-50 cursor-pointer font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-serif font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        Save Credentials
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {activeSubTab === 'blogs' && (() => {
        const filteredBlogs = blogsList.filter((b) => {
          if (!blogSearch.trim()) return true;
          const q = blogSearch.toLowerCase();
          return (
            (b.title || '').toLowerCase().includes(q) ||
            (b.category || '').toLowerCase().includes(q) ||
            (b.summary || '').toLowerCase().includes(q) ||
            (b.author || '').toLowerCase().includes(q)
          );
        });
        const publishedCount = blogsList.filter((b) => b.published !== false).length;

        return (
          <div className="space-y-6 animate-fade-in">
            {/* Blog Management Header Banner */}
            <div className="bg-gradient-to-r from-luxury-brown-950 via-luxury-brown-900 to-[#140D09] text-white p-6 rounded-2xl border border-luxury-gold-500/30 shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-luxury-gold-400 font-bold block">
                  Public Website Blog &amp; Hospitality Insights CMS
                </span>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-luxury-gold-400" />
                  <span>Homepage Blog Section Management</span>
                </h2>
                <p className="text-xs text-luxury-brown-200 max-w-2xl">
                  Create, edit, publish, or remove blog articles displayed on the DirectStay Public Website Homepage (/ #blog). All changes sync immediately.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-mono">
                  Published: <strong className="text-white">{publishedCount}</strong> / {blogsList.length}
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddBlog}
                  className="px-4 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-serif font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add New Blog Post</span>
                </button>
              </div>
            </div>

            {/* Homepage Blog Section Heading & Subtitle Customizer */}
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-luxury-brown-100 pb-3">
                <div>
                  <h3 className="text-sm font-serif font-bold text-luxury-brown-950">
                    Homepage Blog Section Heading &amp; Subtitle
                  </h3>
                  <p className="text-xs text-luxury-brown-500">
                    Customize the title and subtitle shown above the blog cards on the public homepage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    persistUpdatedBlogs(blogsList, {
                      blogHeading: cmsConfig.blogHeading,
                      blogSubtitle: cmsConfig.blogSubtitle,
                    });
                    showToast('Homepage Blog heading & subtitle saved!', 'success');
                  }}
                  className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-300 font-serif font-bold text-xs rounded-xl cursor-pointer"
                >
                  Save Section Heading
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-mono uppercase font-bold text-luxury-brown-700 block mb-1">
                    Blog Section Heading
                  </label>
                  <input
                    type="text"
                    value={cmsConfig.blogHeading || 'Hospitality Insights & Hotel Management Blogs'}
                    onChange={(e) => updateCmsField('blogHeading', e.target.value)}
                    className="w-full px-3.5 py-2 border border-luxury-brown-200 rounded-xl text-xs font-semibold text-luxury-brown-950"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase font-bold text-luxury-brown-700 block mb-1">
                    Blog Section Subtitle
                  </label>
                  <input
                    type="text"
                    value={
                      cmsConfig.blogSubtitle ||
                      'Expert guides, hotel revenue strategies, GST billing tips, and operational best practices published by the DirectStay editorial desk.'
                    }
                    onChange={(e) => updateCmsField('blogSubtitle', e.target.value)}
                    className="w-full px-3.5 py-2 border border-luxury-brown-200 rounded-xl text-xs text-luxury-brown-800"
                  />
                </div>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-luxury-brown-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search blog title, category, author..."
                  value={blogSearch}
                  onChange={(e) => setBlogSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-luxury-brown-200 rounded-xl text-xs"
                />
              </div>
              <div className="text-xs font-mono text-luxury-brown-600">
                Showing <strong>{filteredBlogs.length}</strong> blog posts
              </div>
            </div>

            {/* Blog Cards Grid */}
            {filteredBlogs.length === 0 ? (
              <div className="bg-white border border-luxury-brown-100 rounded-2xl p-12 text-center space-y-3">
                <BookOpen className="w-10 h-10 text-luxury-brown-300 mx-auto" />
                <p className="text-sm font-serif font-bold text-luxury-brown-800">
                  No blog posts found
                </p>
                <p className="text-xs text-luxury-brown-500">
                  Click &ldquo;+ Add New Blog Post&rdquo; above to publish your first article on the homepage.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredBlogs.map((blog) => (
                  <div
                    key={blog.id}
                    className="bg-white border border-luxury-brown-100 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-44 bg-luxury-brown-950 overflow-hidden">
                        {blog.imageUrl ? (
                          <img
                            src={blog.imageUrl}
                            alt={blog.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-luxury-gold-400">
                            <BookOpen className="w-10 h-10 opacity-40" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-full bg-luxury-brown-950/90 text-luxury-gold-400 border border-luxury-gold-500/40 text-[10px] font-mono font-bold uppercase">
                            {blog.category}
                          </span>
                        </div>
                        <div className="absolute top-3 right-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
                              blog.published !== false
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-800 text-gray-300'
                            }`}
                          >
                            {blog.published !== false ? '● Published' : '○ Draft'}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] font-mono text-luxury-brown-500">
                          <span>{blog.publishedAt}</span>
                          <span>{blog.readTime || '4 min read'}</span>
                        </div>
                        <h3 className="font-serif font-bold text-base text-luxury-brown-950 line-clamp-2 leading-snug">
                          {blog.title}
                        </h3>
                        <p className="text-xs text-luxury-brown-600 line-clamp-3 leading-relaxed">
                          {blog.summary}
                        </p>
                        <div className="text-[11px] font-mono text-luxury-brown-500 pt-1">
                          By <strong className="text-luxury-brown-800">{blog.author || 'DirectStay Editorial Desk'}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-3.5 bg-luxury-beige-50/60 border-t border-luxury-brown-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingBlog(blog)}
                          className="px-2.5 py-1.5 rounded-lg border border-luxury-brown-200 bg-white hover:bg-luxury-beige-50 text-luxury-brown-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditBlog(blog)}
                          className="px-2.5 py-1.5 rounded-lg bg-luxury-brown-950 hover:bg-luxury-brown-800 text-luxury-gold-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTogglePublishBlog(blog.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                            blog.published !== false
                              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                              : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                          }`}
                        >
                          {blog.published !== false ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBlog(blog.id, blog.title)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 transition-colors cursor-pointer"
                          title="Delete Blog Post"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add / Edit Blog Post Modal */}
            {showBlogModal && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-3xl border border-luxury-brown-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in my-8">
                  <div className="bg-gradient-to-r from-luxury-brown-950 to-luxury-brown-900 text-white p-5 flex items-center justify-between border-b border-luxury-gold-500/20">
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-5 h-5 text-luxury-gold-400" />
                      <h3 className="font-serif font-bold text-lg">
                        {editingBlogId ? 'Edit Blog Post' : 'Create New Homepage Blog Post'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBlogModal(false)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-luxury-brown-300 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveBlog} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
                    <div>
                      <label className="font-mono uppercase font-bold text-luxury-brown-700 block mb-1">
                        Blog Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={blogTitle}
                        onChange={(e) => setBlogTitle(e.target.value)}
                        placeholder="e.g. How Cloud PMS Increases Direct Hotel Bookings by 35%"
                        className="w-full px-3.5 py-2.5 border border-luxury-brown-200 rounded-xl font-semibold text-luxury-brown-950"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-mono uppercase font-bold text-luxury-brown-700 block mb-1">
                          Category
                        </label>
                        <input
                          type="text"
                          value={blogCategory}
                          onChange={(e) => setBlogCategory(e.target.value)}
                          placeholder="e.g. Revenue Growth"
                          className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl font-semibold"
                        />
                      </div>
                      <div>
                        <label className="font-mono uppercase font-bold text-luxury-brown-700 block mb-1">
                          Author Name
                        </label>
                        <input
                          type="text"
                          value={blogAuthor}
                          onChange={(e) => setBlogAuthor(e.target.value)}
                          placeholder="DirectStay Editorial"
                          className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="font-mono uppercase font-bold text-luxury-brown-700 block mb-1">
                          Read Time &amp; Date
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            value={blogReadTime}
                            onChange={(e) => setBlogReadTime(e.target.value)}
                            placeholder="4 min read"
                            className="px-2.5 py-2 border border-luxury-brown-200 rounded-xl"
                          />
                          <input
                            type="date"
                            value={blogPublishedAt}
                            onChange={(e) => setBlogPublishedAt(e.target.value)}
                            className="px-2 py-2 border border-luxury-brown-200 rounded-xl font-mono text-[11px]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="font-mono uppercase font-bold text-luxury-brown-700 block">
                        Cover Image (URL or Upload Image)
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={blogImageUrl}
                          onChange={(e) => setBlogImageUrl(e.target.value)}
                          placeholder="https://images.unsplash.com/..."
                          className="flex-1 px-3.5 py-2 border border-luxury-brown-200 rounded-xl font-mono"
                        />
                        <label className="px-4 py-2 bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-900 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border border-luxury-brown-200">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Upload Cover</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleBlogImageFileUpload(e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      </div>
                      {blogImageUrl && (
                        <img
                          src={blogImageUrl}
                          alt="Blog Preview"
                          className="h-32 w-full object-cover rounded-xl border border-luxury-brown-200"
                        />
                      )}
                    </div>

                    <div>
                      <label className="font-mono uppercase font-bold text-luxury-brown-700 block mb-1">
                        Short Summary / Excerpt (Displayed on Homepage Card) *
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={blogSummary}
                        onChange={(e) => setBlogSummary(e.target.value)}
                        placeholder="Brief 2-line summary shown on the homepage blog card..."
                        className="w-full p-3 border border-luxury-brown-200 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="font-mono uppercase font-bold text-luxury-brown-700 block mb-1">
                        Full Blog Article Content *
                      </label>
                      <textarea
                        rows={6}
                        required
                        value={blogContent}
                        onChange={(e) => setBlogContent(e.target.value)}
                        placeholder="Write the full blog article content here (use blank lines for paragraphs)..."
                        className="w-full p-3 border border-luxury-brown-200 rounded-xl leading-relaxed"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-luxury-beige-50 border border-luxury-brown-100">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-luxury-brown-950">
                        <input
                          type="checkbox"
                          checked={blogPublished}
                          onChange={(e) => setBlogPublished(e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        <span>Publish immediately on Homepage (/ #blog)</span>
                      </label>
                    </div>

                    <div className="pt-3 flex justify-end gap-3 border-t border-luxury-brown-100">
                      <button
                        type="button"
                        onClick={() => setShowBlogModal(false)}
                        className="px-4 py-2.5 border border-luxury-brown-200 rounded-xl text-luxury-brown-700 font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-serif font-bold rounded-xl shadow-md cursor-pointer"
                      >
                        {editingBlogId ? 'Save Blog Changes' : 'Publish Blog Post'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Preview Blog Modal */}
            {viewingBlog && (
              <div
                onClick={() => setViewingBlog(null)}
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-3xl border border-luxury-brown-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in my-8"
                >
                  <div className="relative h-56 bg-luxury-brown-950">
                    {viewingBlog.imageUrl ? (
                      <img
                        src={viewingBlog.imageUrl}
                        alt={viewingBlog.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-luxury-gold-400">
                        <BookOpen className="w-12 h-12 opacity-40" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setViewingBlog(null)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-black/70 text-white hover:bg-black cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="flex items-center gap-3 text-xs font-mono text-luxury-brown-500">
                      <span className="px-2.5 py-0.5 rounded-full bg-luxury-beige-100 text-luxury-brown-900 font-bold">
                        {viewingBlog.category}
                      </span>
                      <span>{viewingBlog.publishedAt}</span>
                      <span>•</span>
                      <span>{viewingBlog.readTime}</span>
                      <span>•</span>
                      <span>By {viewingBlog.author || 'DirectStay Editorial Desk'}</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-serif font-bold text-luxury-brown-950">
                      {viewingBlog.title}
                    </h2>
                    <p className="text-sm font-semibold text-luxury-brown-700 border-l-4 border-luxury-gold-500 pl-3">
                      {viewingBlog.summary}
                    </p>
                    <div className="space-y-3 text-xs sm:text-sm text-luxury-brown-800 leading-relaxed whitespace-pre-line">
                      {viewingBlog.content}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {activeSubTab === 'dashboard' && (
        <div className="space-y-6 sm:space-y-8 animate-fade-in" id="saas-dashboard-tab">
            {/* 3x3 Grid of 9 KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-5">
              {/* Card 1: Total Hotels */}
              <div
                onClick={() => { setActiveSubTab('hotels'); setHotelFilter('All'); }}
                className="bg-white border border-luxury-brown-100 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:border-luxury-gold-500/40 hover:shadow-md transition-all duration-300 cursor-pointer group"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500 block">Total Hotels</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-luxury-brown-950">{totalHotelsCount}</span>
                    <span className="text-[10px] text-luxury-brown-500 font-mono font-bold group-hover:text-luxury-gold-600 transition-colors">Properties →</span>
                  </div>
                  <p className="text-[10px] text-luxury-brown-400 font-mono">Onboarded in core SaaS network</p>
                </div>
                <div className="p-3.5 bg-luxury-gold-500/10 text-luxury-gold-600 rounded-2xl group-hover:scale-105 transition-transform">
                  <Building className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Active Hotels */}
              <div
                onClick={() => { setActiveSubTab('hotels'); setHotelFilter('Active'); }}
                className="bg-white border border-luxury-brown-100 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:border-emerald-500/30 hover:shadow-md transition-all duration-300 cursor-pointer group"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500 block">Active Hotels</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-emerald-600">{activeHotelsCount}</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-bold">Approved →</span>
                  </div>
                  <p className="text-[10px] text-luxury-brown-400 font-mono">Running live PMS operations</p>
                </div>
                <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-105 transition-transform">
                  <CheckCircle className="w-6 h-6" />
                </div>
              </div>

              {/* Card 3: Pending Approvals */}
              <div 
                onClick={() => {
                  setActiveSubTab('hotels');
                  setHotelFilter('Pending');
                }}
                className="bg-gradient-to-br from-amber-50/80 to-white border-2 border-amber-300 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:border-amber-500 hover:shadow-md transition-all duration-300 cursor-pointer group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-amber-900 block">Pending Approvals</span>
                    {pendingApprovalsCount > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white font-mono text-[9px] font-bold rounded-full animate-pulse">
                        ACTION NEEDED
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-amber-700">{pendingApprovalsCount}</span>
                    <span className="text-xs text-amber-800 font-bold underline group-hover:text-amber-950">
                      Review Queue →
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-700 font-mono">Click to review & direct approve</p>
                </div>
                <div className="p-3.5 bg-amber-500 text-white rounded-2xl shadow-sm group-hover:scale-105 transition-transform">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              {/* Card 4: Free Trial Hotels */}
              <div
                onClick={() => { setActiveSubTab('hotels'); setHotelFilter('Trial'); }}
                className="bg-white border border-luxury-brown-100 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:border-sky-500/30 hover:shadow-md transition-all duration-300 cursor-pointer group"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500 block">Free Trial Hotels</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-sky-600">{freeTrialCount}</span>
                    <span className="text-[10px] text-sky-600 font-mono font-bold">7-Day Trial →</span>
                  </div>
                  <p className="text-[10px] text-luxury-brown-400 font-mono">Evaluating platform features</p>
                </div>
                <div className="p-3.5 bg-sky-50 text-sky-600 rounded-2xl group-hover:scale-105 transition-transform">
                  <Layers className="w-6 h-6" />
                </div>
              </div>

              {/* Card 5: Membership Expiring in 7 Days */}
              <div
                onClick={() => { setActiveSubTab('hotels'); setHotelFilter('Expiring'); }}
                className="bg-white border border-luxury-brown-100 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:border-rose-500/30 hover:shadow-md transition-all duration-300 cursor-pointer group"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500 block">Expiring in 7 Days</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-rose-500">{membershipExpiringCount}</span>
                    <span className="text-[10px] text-rose-500 font-mono font-bold">
                      {membershipExpiringCount > 0 ? 'Action Needed →' : 'None Due'}
                    </span>
                  </div>
                  <p className="text-[10px] text-luxury-brown-400 font-mono">Upcoming renewal window</p>
                </div>
                <div className="p-3.5 bg-rose-50 text-rose-500 rounded-2xl group-hover:scale-105 transition-transform">
                  <AlertCircle className="w-6 h-6" />
                </div>
              </div>

              {/* Card 6: Expired Memberships */}
              <div
                onClick={() => { setActiveSubTab('hotels'); setHotelFilter('Expired'); }}
                className="bg-white border border-luxury-brown-100 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:border-gray-500/30 hover:shadow-md transition-all duration-300 cursor-pointer group"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500 block">Expired Memberships</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-gray-700">{expiredCount}</span>
                    <span className="text-[10px] text-gray-500 font-mono font-bold">Lapsed →</span>
                  </div>
                  <p className="text-[10px] text-luxury-brown-400 font-mono">Restricted feature access</p>
                </div>
                <div className="p-3.5 bg-gray-50 text-gray-500 rounded-2xl group-hover:scale-105 transition-transform">
                  <ShieldAlert className="w-6 h-6" />
                </div>
              </div>

              {/* Card 7: Monthly SaaS Revenue */}
              <div className="bg-gradient-to-br from-white to-emerald-50/20 border border-luxury-brown-100 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:border-emerald-500/40 transition-all duration-300">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-emerald-800 block">Monthly SaaS Revenue</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-serif font-bold text-luxury-brown-950">₹{monthlyRevenueSum.toLocaleString()}</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-bold">/mo MRR</span>
                  </div>
                  <p className="text-[10px] text-luxury-brown-500 font-mono">Dynamic recurring contribution</p>
                </div>
                <div className="p-3.5 bg-emerald-500/10 text-emerald-600 rounded-2xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

              {/* Card 8: Total SaaS Revenue */}
              <div className="bg-gradient-to-br from-white to-luxury-beige-100/20 border border-luxury-brown-100 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:border-luxury-gold-500/40 transition-all duration-300">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-800 block">Total SaaS Revenue</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-serif font-bold text-luxury-brown-950">₹{totalRevenueSum.toLocaleString()}</span>
                    <span className="text-[10px] text-luxury-gold-600 font-mono font-bold">LTV Gross</span>
                  </div>
                  <p className="text-[10px] text-luxury-brown-500 font-mono">All-time package fees settled</p>
                </div>
                <div className="p-3.5 bg-luxury-gold-500/10 text-luxury-gold-600 rounded-2xl">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>

              {/* Card 9: Total Packages Sold */}
              <div
                onClick={() => setActiveSubTab('packages')}
                className="bg-white border border-luxury-brown-100 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:border-purple-500/30 hover:shadow-md transition-all duration-300 cursor-pointer group"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500 block">Total Packages Sold</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-purple-600">{totalPackagesSold}</span>
                    <span className="text-[10px] text-purple-600 font-mono font-bold">Contracts →</span>
                  </div>
                  <p className="text-[10px] text-luxury-brown-400 font-mono">Non-Trial subscriptions active</p>
                </div>
                <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl group-hover:scale-105 transition-transform">
                  <CreditCard className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Pending Hotel Approval Direct Action Section */}
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-100/50 to-emerald-500/10 border-2 border-amber-300 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-amber-200/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-sm shrink-0">
                    <Clock className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                      Pending Hotel Registration Requests
                      <span className="px-2.5 py-0.5 bg-amber-500 text-white text-xs font-mono font-bold rounded-full">
                        {pendingApprovalsCount} Pending
                      </span>
                    </h3>
                    <p className="text-xs text-luxury-brown-600 mt-0.5">
                      Review newly onboarded hotel properties and grant immediate live platform access with 1-click Direct Approve.
                    </p>
                  </div>
                </div>

                {pendingApprovalsCount > 0 && (
                  <button
                    onClick={handleApproveAllPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-102 shrink-0"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Direct Approve All ({pendingApprovalsCount})</span>
                  </button>
                )}
              </div>

              {pendingApprovalsCount === 0 ? (
                <div className="p-6 bg-white/80 rounded-2xl text-center text-xs font-mono text-emerald-800 font-bold border border-emerald-200 flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>All hotel registration requests are currently approved! No pending approvals.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hotels.filter(h => getHotelStatus(h) === 'Pending').map(pendingHotel => (
                    <div key={pendingHotel.id} className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs space-y-3 flex flex-col justify-between hover:border-amber-400 transition-all">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <img src={pendingHotel.logoUrl} alt={pendingHotel.name} className="w-8 h-8 rounded-lg object-cover border border-amber-200 shrink-0" />
                            <div className="truncate">
                              <h4 className="font-serif font-bold text-xs text-luxury-brown-950 truncate" title={pendingHotel.name}>{pendingHotel.name}</h4>
                              <p className="font-mono text-[9px] text-luxury-brown-500">ID: {pendingHotel.id}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 font-mono text-[9px] font-bold rounded-md shrink-0">
                            PENDING
                          </span>
                        </div>

                        <div className="text-[11px] font-mono space-y-1 bg-luxury-beige-50/60 p-2.5 rounded-xl border border-luxury-brown-100">
                          <div><span className="text-luxury-brown-500">Owner:</span> <strong className="text-luxury-brown-900">{pendingHotel.ownerName || 'N/A'}</strong></div>
                          <div><span className="text-luxury-brown-500">Phone:</span> <span className="text-luxury-brown-900">{pendingHotel.phoneNumber || 'N/A'}</span></div>
                          <div><span className="text-luxury-brown-500">Email:</span> <span className="text-luxury-brown-900 truncate block">{pendingHotel.emailAddress || 'N/A'}</span></div>
                          <div><span className="text-luxury-brown-500">Plan:</span> <span className="font-bold text-luxury-gold-700">{pendingHotel.subscriptionPlan || 'Trial'}</span></div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleUpdateStatus(pendingHotel.id, 'Approved')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer hover:scale-102"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Direct Approve</span>
                        </button>
                        <button
                          onClick={() => setViewingHotel(pendingHotel)}
                          className="p-2 border border-luxury-brown-200 hover:bg-luxury-beige-100 rounded-xl text-luxury-brown-700 transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Chart 1: Monthly SaaS Revenue SVG */}
              <div className="bg-white border border-luxury-brown-100 p-6 rounded-3xl shadow-xs space-y-4 relative">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-serif font-bold text-luxury-brown-950">Monthly SaaS Revenue Trend</h3>
                    <p className="text-[10px] text-luxury-brown-400 font-mono">Past 6 Months Area Projection</p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-sans">MRR Growth: +197%</span>
                </div>

                {/* SVG Area/Line Chart */}
                <div className="relative pt-4 h-52">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="revenue-area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C5A059" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#C5A059" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Gridlines */}
                    <line x1="0" y1="40" x2="500" y2="40" stroke="#f5ede0" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="80" x2="500" y2="80" stroke="#f5ede0" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="120" x2="500" y2="120" stroke="#f5ede0" strokeWidth="1" strokeDasharray="4 4" />

                    {/* Area path */}
                    <path 
                      d="M 0 130 Q 50 125, 100 120 T 200 120 T 300 90 T 400 45 T 500 20 L 500 150 L 0 150 Z" 
                      fill="url(#revenue-area-grad)" 
                    />

                    {/* Line path */}
                    <path 
                      d="M 0 130 Q 50 125, 100 120 T 200 120 T 300 90 T 400 45 T 500 20" 
                      fill="none" 
                      stroke="#C5A059" 
                      strokeWidth="3.5" 
                      strokeLinecap="round"
                    />

                    {/* Interactive dots */}
                    {[
                      { x: 0, y: 130, val: '₹14,000', m: 'Feb 2026' },
                      { x: 100, y: 120, val: '₹15,899', m: 'Mar 2026' },
                      { x: 200, y: 120, val: '₹15,899', m: 'Apr 2026' },
                      { x: 300, y: 90, val: '₹23,898', m: 'May 2026' },
                      { x: 400, y: 45, val: '₹37,898', m: 'Jun 2026' },
                      { x: 500, y: 20, val: `₹${totalRevenueSum.toLocaleString()}`, m: 'Jul 2026 (Live)' }
                    ].map((pt, i) => (
                      <g key={i}>
                        <circle 
                          cx={pt.x} 
                          cy={pt.y} 
                          r={hoveredRevenueIndex === i ? "7" : "4.5"} 
                          fill="#C5A059" 
                          stroke="#ffffff" 
                          strokeWidth="2" 
                          className="cursor-pointer transition-all duration-150"
                          onMouseEnter={() => setHoveredRevenueIndex(i)}
                          onMouseLeave={() => setHoveredRevenueIndex(null)}
                        />
                        {hoveredRevenueIndex === i && (
                          <circle cx={pt.x} cy={pt.y} r="14" fill="#C5A059" opacity="0.15" />
                        )}
                      </g>
                    ))}
                  </svg>
                  
                  {/* Tooltip Popup */}
                  {hoveredRevenueIndex !== null && (() => {
                    const dataPoints = [
                      { val: '₹14,000', m: 'Feb 2026', desc: 'Yearly subscription bought' },
                      { val: '₹15,899', m: 'Mar 2026', desc: '+1 Pro Monthly package' },
                      { val: '₹15,899', m: 'Apr 2026', desc: 'Stable recurring base' },
                      { val: '₹23,898', m: 'May 2026', desc: '+1 Half-Yearly package' },
                      { val: '₹37,898', m: 'Jun 2026', desc: '+1 Yearly upgrade' },
                      { val: `₹${totalRevenueSum.toLocaleString()}`, m: 'Jul 2026 (Live)', desc: 'Current settled SaaS billing' }
                    ];
                    const activePoint = dataPoints[hoveredRevenueIndex];
                    return (
                      <div className="absolute top-0 right-4 bg-luxury-brown-950 text-white p-3 rounded-xl border border-luxury-gold-500/20 shadow-md text-xs z-20 w-44 animate-fade-in pointer-events-none">
                        <span className="font-mono text-[9px] text-luxury-gold-400 block uppercase font-bold">{activePoint.m}</span>
                        <span className="text-sm font-bold block mt-0.5">{activePoint.val}</span>
                        <span className="text-[9px] text-luxury-brown-200 block leading-tight mt-1">{activePoint.desc}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* X Axis Labels */}
                <div className="flex justify-between text-[10px] font-mono text-luxury-brown-400 pt-1 px-1 border-t border-luxury-brown-50">
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr</span>
                  <span>May</span>
                  <span>Jun</span>
                  <span>Jul</span>
                </div>
              </div>

              {/* Chart 2: New Hotel Registrations SVG Bar */}
              <div className="bg-white border border-luxury-brown-100 p-6 rounded-2xl shadow-2xs space-y-4 relative">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-serif font-bold text-luxury-brown-950">New Hotel Registrations</h3>
                    <p className="text-[10px] text-luxury-brown-400 font-mono">Monthly Signup Trends</p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md font-sans">
                    Total Clients: {totalHotelsCount}
                  </span>
                </div>

                {/* SVG Bar Chart */}
                <div className="relative pt-4 h-52">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160" preserveAspectRatio="none">
                    {/* Gridlines */}
                    <line x1="0" y1="40" x2="500" y2="40" stroke="#f5ede0" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="80" x2="500" y2="80" stroke="#f5ede0" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="120" x2="500" y2="120" stroke="#f5ede0" strokeWidth="1" strokeDasharray="4 4" />

                    {/* Bars: Feb(1), Mar(1), Apr(2), May(1), Jun(1), Jul(2) */}
                    {[
                      { x: 30, h: 50, val: '1 Registration', m: 'February 2026', desc: 'Grand Pavilion setup' },
                      { x: 110, h: 50, val: '1 Registration', m: 'March 2026', desc: 'Organic web referral' },
                      { x: 190, h: 100, val: '2 Registrations', m: 'April 2026', desc: 'Toshali Sands + Chilika Lake' },
                      { x: 270, h: 50, val: '1 Registration', m: 'May 2026', desc: 'Mayfair Beach signup' },
                      { x: 350, h: 50, val: '1 Registration', m: 'June 2026', desc: 'Blue Bayou onboarding' },
                      { x: 430, h: 100, val: '2 Registrations', m: 'July 2026 (Live)', desc: 'Swosti Premium + Coco Palms' }
                    ].map((bar, i) => (
                      <g key={i}>
                        <rect 
                          x={bar.x} 
                          y={150 - bar.h} 
                          width="40" 
                          height={bar.h} 
                          rx="6" 
                          ry="6"
                          fill={hoveredRegIndex === i ? "#C5A059" : "#dfd1b8"}
                          className="cursor-pointer transition-colors duration-150"
                          onMouseEnter={() => setHoveredRegIndex(i)}
                          onMouseLeave={() => setHoveredRegIndex(null)}
                        />
                      </g>
                    ))}
                  </svg>

                  {/* Bar Chart Tooltip */}
                  {hoveredRegIndex !== null && (() => {
                    const barPoints = [
                      { x: 30, val: '1 Registration', m: 'February 2026', desc: 'Grand Pavilion setup' },
                      { x: 110, val: '1 Registration', m: 'March 2026', desc: 'Organic web referral' },
                      { x: 190, val: '2 Registrations', m: 'April 2026', desc: 'Toshali Sands + Chilika Lake' },
                      { x: 270, val: '1 Registration', m: 'May 2026', desc: 'Mayfair Beach signup' },
                      { x: 350, val: '1 Registration', m: 'June 2026', desc: 'Blue Bayou onboarding' },
                      { x: 430, val: '2 Registrations', m: 'July 2026 (Live)', desc: 'Swosti Premium + Coco Palms' }
                    ];
                    const activeBar = barPoints[hoveredRegIndex];
                    return (
                      <div className="absolute top-0 right-4 bg-luxury-brown-950 text-white p-3 rounded-xl border border-luxury-gold-500/20 shadow-md text-xs z-20 w-44 animate-fade-in pointer-events-none">
                        <span className="font-mono text-[9px] text-luxury-gold-400 block uppercase font-bold">{activeBar.m}</span>
                        <span className="text-sm font-bold block mt-0.5">{activeBar.val}</span>
                        <span className="text-[9px] text-luxury-brown-200 block leading-tight mt-1">{activeBar.desc}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* X Axis Labels */}
                <div className="flex justify-between text-[10px] font-mono text-luxury-brown-400 pt-1 px-1 border-t border-luxury-brown-50">
                  <span className="w-12 text-center ml-2">Feb</span>
                  <span className="w-12 text-center">Mar</span>
                  <span className="w-12 text-center">Apr</span>
                  <span className="w-12 text-center">May</span>
                  <span className="w-12 text-center">Jun</span>
                  <span className="w-12 text-center mr-2">Jul</span>
                </div>
              </div>

              {/* Chart 3: Package Distribution */}
              <div className="bg-white border border-luxury-brown-100 p-6 rounded-2xl shadow-2xs space-y-5">
                <div>
                  <h3 className="text-sm font-serif font-bold text-luxury-brown-950">SaaS Package Distribution</h3>
                  <p className="text-[10px] text-luxury-brown-400 font-mono">Client Billing Plan Breakdown</p>
                </div>

                <div className="space-y-4 pt-1">
                  {/* Free Trial Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-sky-700">Free Trial Packages</span>
                      <span className="font-mono font-bold text-sky-800">{distTrial} Hotels ({Math.round((distTrial / Math.max(1, totalHotelsCount)) * 100)}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 transition-all duration-500" style={{ width: `${(distTrial / Math.max(1, totalHotelsCount)) * 100}%` }} />
                    </div>
                  </div>

                  {/* Monthly Pro Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-emerald-700">Pro Monthly Plan (₹1,899/mo)</span>
                      <span className="font-mono font-bold text-emerald-800">{distMonthly} Hotels ({Math.round((distMonthly / Math.max(1, totalHotelsCount)) * 100)}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(distMonthly / Math.max(1, totalHotelsCount)) * 100}%` }} />
                    </div>
                  </div>

                  {/* Half-Yearly Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-indigo-700">6-Month Package (₹7,999)</span>
                      <span className="font-mono font-bold text-indigo-800">{distHalfYearly} Hotel ({Math.round((distHalfYearly / Math.max(1, totalHotelsCount)) * 100)}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(distHalfYearly / Math.max(1, totalHotelsCount)) * 100}%` }} />
                    </div>
                  </div>

                  {/* Yearly Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-luxury-gold-700 font-serif">Enterprise Yearly (₹14,000)</span>
                      <span className="font-mono font-bold text-luxury-gold-800">{distYearly} Hotels ({Math.round((distYearly / Math.max(1, totalHotelsCount)) * 100)}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-luxury-gold-500 transition-all duration-500" style={{ width: `${(distYearly / Math.max(1, totalHotelsCount)) * 100}%` }} />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-luxury-brown-50 flex gap-4 text-[10px] font-mono text-luxury-brown-500 justify-center">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-sky-500 rounded-full inline-block" /> Trial</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block" /> Monthly</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-full inline-block" /> 6-Month</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-luxury-gold-500 rounded-full inline-block" /> Yearly</span>
                </div>
              </div>

              {/* Chart 4: Active vs Expired Hotels */}
              <div className="bg-white border border-luxury-brown-100 p-6 rounded-2xl shadow-2xs space-y-5">
                <div>
                  <h3 className="text-sm font-serif font-bold text-luxury-brown-950">Active vs Expired Hotels</h3>
                  <p className="text-[10px] text-luxury-brown-400 font-mono">Tenant Status Allocation Meter</p>
                </div>

                <div className="flex items-center justify-around py-2">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                      <circle cx="64" cy="64" r="54" fill="transparent" stroke="#f5ede0" strokeWidth="8" />
                      <circle cx="64" cy="64" r="54" fill="transparent" stroke="#10b981" strokeWidth="8" 
                        strokeDasharray={`${2 * Math.PI * 54}`} 
                        strokeDashoffset={`${2 * Math.PI * 54 * (1 - activeHotelsCount / Math.max(1, totalHotelsCount))}`} 
                        strokeLinecap="round"
                      />
                    </svg>

                    <svg className="absolute inset-0 w-full h-full transform -rotate-90 scale-75 origin-center">
                      <circle cx="64" cy="64" r="54" fill="transparent" stroke="#f5ede0" strokeWidth="10" />
                      <circle cx="64" cy="64" r="54" fill="transparent" stroke="#6b7280" strokeWidth="10" 
                        strokeDasharray={`${2 * Math.PI * 54}`} 
                        strokeDashoffset={`${2 * Math.PI * 54 * (1 - expiredCount / Math.max(1, totalHotelsCount))}`} 
                        strokeLinecap="round"
                      />
                    </svg>

                    <svg className="absolute inset-0 w-full h-full transform -rotate-90 scale-50 origin-center">
                      <circle cx="64" cy="64" r="54" fill="transparent" stroke="#f5ede0" strokeWidth="12" />
                      <circle cx="64" cy="64" r="54" fill="transparent" stroke="#f59e0b" strokeWidth="12" 
                        strokeDasharray={`${2 * Math.PI * 54}`} 
                        strokeDashoffset={`${2 * Math.PI * 54 * (1 - pendingApprovalsCount / Math.max(1, totalHotelsCount))}`} 
                        strokeLinecap="round"
                      />
                    </svg>

                    <div className="text-center space-y-0.5 z-10">
                      <span className="text-xl font-serif font-black text-luxury-brown-950 block">{Math.round((activeHotelsCount / Math.max(1, totalHotelsCount)) * 100)}%</span>
                      <span className="text-[9px] font-mono font-bold text-emerald-600 uppercase tracking-wider block">Active Rate</span>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <div className="flex items-start gap-2 text-xs">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full mt-0.5" />
                      <div>
                        <span className="font-bold text-luxury-brown-900 block">Active Hotels</span>
                        <span className="text-[10px] text-luxury-brown-400 font-mono">{activeHotelsCount} Properties ({Math.round((activeHotelsCount/Math.max(1, totalHotelsCount))*100)}%)</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-xs">
                      <div className="w-3 h-3 bg-gray-500 rounded-full mt-0.5" />
                      <div>
                        <span className="font-bold text-luxury-brown-900 block">Expired Memberships</span>
                        <span className="text-[10px] text-luxury-brown-400 font-mono">{expiredCount} Properties ({Math.round((expiredCount/Math.max(1, totalHotelsCount))*100)}%)</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-xs">
                      <div className="w-3 h-3 bg-amber-500 rounded-full mt-0.5" />
                      <div>
                        <span className="font-bold text-luxury-brown-900 block">Pending Approvals</span>
                        <span className="text-[10px] text-luxury-brown-400 font-mono">{pendingApprovalsCount} Properties ({Math.round((pendingApprovalsCount/Math.max(1, totalHotelsCount))*100)}%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live SaaS Activity Stream */}
            <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-luxury-gold-500" /> SaaS Operations Recent Activities
                  </h3>
                  <p className="text-xs text-luxury-brown-500">
                    Real-time logs for DirectStay SaaS business registrations, license approvals, and membership status upgrades.
                  </p>
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap gap-1.5 bg-luxury-beige-100/50 p-1 rounded-xl border border-luxury-brown-100/30">
                  {(['All', 'Registration', 'Approval', 'Renewal', 'Upgrade', 'Suspension'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setActivityFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all font-mono uppercase ${activityFilter === f ? 'bg-luxury-brown-950 text-white shadow-xs' : 'text-luxury-brown-600 hover:bg-luxury-beige-100'}`}
                    >
                      {f}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Timeline List */}
              <div className="relative border-l-2 border-luxury-brown-50 pl-6 ml-3 space-y-6">
                {filteredActivities.length === 0 ? (
                  <div className="text-center py-6 text-xs text-luxury-brown-400 font-mono">
                    No recent events matched this SaaS activity filter.
                  </div>
                ) : (
                  filteredActivities.map((act) => {
                    let pillColor = "text-sky-700 bg-sky-50 border-sky-100";
                    if (act.type === 'Approval') pillColor = "text-emerald-700 bg-emerald-50 border-emerald-100";
                    if (act.type === 'Renewal') pillColor = "text-teal-700 bg-teal-50 border-teal-100";
                    if (act.type === 'Upgrade') pillColor = "text-purple-700 bg-purple-50 border-purple-100";
                    if (act.type === 'Suspension') pillColor = "text-rose-700 bg-rose-50 border-rose-100";

                    return (
                      <div key={act.id} className="relative group animate-fade-in">
                        <div className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full bg-white border-2 border-luxury-gold-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-luxury-gold-500" />
                        </div>

                        <div className="bg-luxury-beige-50/40 border border-luxury-brown-100/40 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white hover:shadow-xs hover:border-luxury-gold-500/10 transition-all">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-luxury-brown-950 text-xs">{act.hotelName}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase font-bold border ${pillColor}`}>
                                {act.type}
                              </span>
                              {act.amount && (
                                <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                  {act.amount}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-luxury-brown-600">{act.description}</p>
                          </div>

                          <div className="text-right shrink-0 font-mono">
                            <span className="text-[10px] text-luxury-brown-400 block">{act.date}</span>
                            <span className="text-[9px] text-luxury-brown-400 block">{act.time}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 flex justify-between items-center border-b border-luxury-gold-500/10">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-luxury-gold-400" />
                <h3 className="font-serif font-bold text-lg">Onboard New SaaS Property</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-luxury-brown-800 rounded-lg text-luxury-brown-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Wizard Steps Progress Bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-luxury-beige-50 border-b border-luxury-brown-100/60">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all duration-300 ${onboardingStep >= 1 ? 'bg-luxury-gold-500 text-luxury-brown-950 font-bold shadow-xs' : 'bg-luxury-brown-100 text-luxury-brown-400'}`}>
                  1
                </div>
                <span className={`text-[11px] font-bold transition-colors duration-300 ${onboardingStep === 1 ? 'text-luxury-brown-950' : 'text-luxury-brown-400'}`}>
                  Property Info
                </span>
              </div>
              <div className="flex-1 h-0.5 mx-3 bg-luxury-brown-100/60 relative">
                <div className="absolute top-0 left-0 h-full bg-luxury-gold-500 transition-all duration-300" style={{ width: onboardingStep > 1 ? '100%' : '0%' }} />
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all duration-300 ${onboardingStep >= 2 ? 'bg-luxury-gold-500 text-luxury-brown-950 font-bold shadow-xs' : 'bg-luxury-brown-100 text-luxury-brown-400'}`}>
                  2
                </div>
                <span className={`text-[11px] font-bold transition-colors duration-300 ${onboardingStep === 2 ? 'text-luxury-brown-950' : 'text-luxury-brown-400'}`}>
                  Credentials
                </span>
              </div>
              <div className="flex-1 h-0.5 mx-3 bg-luxury-brown-100/60 relative">
                <div className="absolute top-0 left-0 h-full bg-luxury-gold-500 transition-all duration-300" style={{ width: onboardingStep > 2 ? '100%' : '0%' }} />
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all duration-300 ${onboardingStep >= 3 ? 'bg-luxury-gold-500 text-luxury-brown-950 font-bold shadow-xs' : 'bg-luxury-brown-100 text-luxury-brown-400'}`}>
                  3
                </div>
                <span className={`text-[11px] font-bold transition-colors duration-300 ${onboardingStep === 3 ? 'text-luxury-brown-950' : 'text-luxury-brown-400'}`}>
                  Setup & Seed
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleAddHotelSubmit} className="p-6 space-y-4">
              {stepErrors && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="font-medium">{stepErrors}</span>
                </div>
              )}

              {onboardingStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Hotel Name *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Royal Heritage Resort"
                      value={newHotelName}
                      onChange={(e) => {
                        setNewHotelName(e.target.value);
                        if (stepErrors) setStepErrors(null);
                      }}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-luxury-brown-700 block">Phone Number</label>
                      <input 
                        type="text" 
                        placeholder="e.g. +91 94370 54321"
                        value={newHotelPhone}
                        onChange={(e) => setNewHotelPhone(e.target.value)}
                        className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-luxury-brown-700 block">GSTIN Number</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 21AAAAA1234A1Z1"
                        value={newHotelGst}
                        onChange={(e) => setNewHotelGst(e.target.value)}
                        className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="e.g. reservations@royalheritage.com"
                      value={newHotelEmail}
                      onChange={(e) => setNewHotelEmail(e.target.value)}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Property Address</label>
                    <textarea 
                      rows={2}
                      placeholder="e.g. Sea Beach Rd, Puri, Odisha 752001"
                      value={newHotelAddress}
                      onChange={(e) => setNewHotelAddress(e.target.value)}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 resize-none"
                    />
                  </div>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-luxury-brown-700 block">Hotel Login Username *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. grandadmin"
                        value={newHotelUsername}
                        onChange={(e) => {
                          setNewHotelUsername(e.target.value);
                          if (stepErrors) setStepErrors(null);
                        }}
                        className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-luxury-brown-700 block">Hotel Login Password *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. password123"
                        value={newHotelPassword}
                        onChange={(e) => {
                          setNewHotelPassword(e.target.value);
                          if (stepErrors) setStepErrors(null);
                        }}
                        className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Property Brand Logo Upload</label>
                    <div 
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-4 text-center transition-all flex flex-col items-center justify-center gap-1.5 ${dragActive ? 'border-luxury-gold-500 bg-luxury-gold-500/10' : 'border-luxury-brown-100 bg-luxury-beige-100/10 hover:border-luxury-gold-500/30'}`}
                    >
                      <input 
                        type="file" 
                        id="admin-logo-upload"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) handleLogoUpload(e.target.files[0]);
                        }}
                        className="hidden"
                      />
                      {newHotelLogo ? (
                        <div className="flex items-center gap-3">
                          <img 
                            src={newHotelLogo} 
                            alt="Logo Uploaded" 
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-lg object-cover border border-luxury-gold-500/30"
                          />
                          <div className="text-left">
                            <span className="text-[11px] text-emerald-600 font-bold block">✓ Brand Logo Attached</span>
                            <button 
                              type="button" 
                              onClick={() => setNewHotelLogo('')}
                              className="text-[10px] text-rose-500 hover:underline block"
                            >
                              Remove Image
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label htmlFor="admin-logo-upload" className="cursor-pointer">
                          <span className="text-xs text-luxury-brown-700 font-bold hover:text-luxury-gold-600 transition-colors">Drag logo file here or click to choose</span>
                          <span className="block text-[10px] text-luxury-brown-400 font-mono mt-0.5">Supports PNG, JPG, WebP</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Property Room Inventory Size Tier *</label>
                    <div className="grid grid-cols-4 gap-2 pt-0.5">
                      {[
                        { val: '1-10', lab: '1 to 10', rooms: '8 rooms' },
                        { val: '10-20', lab: '10 to 20', rooms: '15 rooms' },
                        { val: '20-30', lab: '20 to 30', rooms: '25 rooms' },
                        { val: '30-50', lab: '30 to 50', rooms: '40 rooms' }
                      ].map(tierOption => (
                        <button
                          key={tierOption.val}
                          type="button"
                          onClick={() => setRoomTier(tierOption.val as any)}
                          className={`p-2 rounded-xl border text-center transition-all ${roomTier === tierOption.val ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-luxury-brown-950 shadow-xs' : 'border-luxury-brown-100 hover:bg-luxury-beige-50 text-luxury-brown-600'}`}
                        >
                          <span className="block text-xs font-serif">{tierOption.lab}</span>
                          <span className="text-[9px] text-luxury-brown-400 font-mono">{tierOption.rooms}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Subscription Package Pack *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                      {[
                        { val: 'Trial', lab: 'Free Trial', desc: '7 Days' },
                        { val: 'Monthly', lab: 'Monthly', desc: '₹1899 + GST' },
                        { val: 'HalfYearly', lab: '6-Month', desc: '₹7999 + GST' },
                        { val: 'Yearly', lab: 'Yearly', desc: '₹14000 + GST' }
                      ].map(planOption => (
                        <button
                          key={planOption.val}
                          type="button"
                          onClick={() => setSelectedPlan(planOption.val as any)}
                          className={`p-2 rounded-xl border text-center transition-all ${selectedPlan === planOption.val ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-luxury-brown-950 shadow-xs' : 'border-luxury-brown-100 hover:bg-luxury-beige-50 text-luxury-brown-600'}`}
                        >
                          <span className="block text-xs font-serif">{planOption.lab}</span>
                          <span className="text-[9px] text-luxury-brown-500 font-mono block">{planOption.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Aesthetic Seed Design Template (Fallback)</label>
                    <div className="grid grid-cols-3 gap-3 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedTemplate('Boutique')}
                        className={`p-2.5 rounded-xl border text-center transition-all ${selectedTemplate === 'Boutique' ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-luxury-brown-900 shadow-xs' : 'border-luxury-brown-100 hover:bg-luxury-beige-50'}`}
                      >
                        <span className="block text-xs font-serif">Boutique style</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTemplate('Luxury')}
                        className={`p-2.5 rounded-xl border text-center transition-all ${selectedTemplate === 'Luxury' ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-luxury-brown-900 shadow-xs' : 'border-luxury-brown-100 hover:bg-luxury-beige-50'}`}
                      >
                        <span className="block text-xs font-serif">Luxury style</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTemplate('Budget')}
                        className={`p-2.5 rounded-xl border text-center transition-all ${selectedTemplate === 'Budget' ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-luxury-brown-900 shadow-xs' : 'border-luxury-brown-100 hover:bg-luxury-beige-50'}`}
                      >
                        <span className="block text-xs font-serif">Budget style</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 flex gap-3 border-t border-luxury-brown-50">
                {onboardingStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOnboardingStep(prev => prev - 1);
                      setStepErrors(null);
                    }}
                    className="flex-1 border border-luxury-brown-100 text-luxury-brown-600 font-semibold px-4 py-2.5 rounded-xl text-xs hover:bg-luxury-beige-50 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 border border-luxury-brown-100 text-luxury-brown-600 font-semibold px-4 py-2.5 rounded-xl text-xs hover:bg-luxury-beige-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}

                {onboardingStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onboardingStep === 1) {
                        if (!newHotelName.trim()) {
                          setStepErrors('Hotel Name is required to proceed.');
                          return;
                        }
                      } else if (onboardingStep === 2) {
                        if (!newHotelUsername.trim() || !newHotelPassword.trim()) {
                          setStepErrors('Both Username and Security Passcode are required.');
                          return;
                        }
                      }
                      setStepErrors(null);
                      setOnboardingStep(prev => prev + 1);
                    }}
                    className="flex-1 bg-luxury-brown-950 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md hover:bg-luxury-brown-900 transition-all flex items-center justify-center gap-1.5"
                  >
                    Next <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="flex-1 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-luxury-gold-500/5 transition-all"
                  >
                    Confirm & Provision
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Profile Modal */}
      {viewingHotel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 flex justify-between items-center border-b border-luxury-gold-500/10">
              <div className="flex items-center gap-3">
                <img src={viewingHotel.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/20" referrerPolicy="no-referrer" />
                <div>
                  <h3 className="font-serif font-bold text-lg leading-snug">{viewingHotel.name}</h3>
                  <p className="text-[10px] text-luxury-gold-300 font-mono tracking-wider uppercase">Independent Tenant Profile</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.open(`/?hotelBooking=${encodeURIComponent(viewingHotel.id)}`, '_blank')}
                  className="px-3 py-1.5 rounded-xl bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Open Hotel in New Tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in New Tab</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setViewingHotel(null)}
                  className="p-1.5 hover:bg-luxury-brown-800 rounded-lg text-luxury-brown-300 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Profile Grid */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto text-sm text-luxury-brown-900">
              {/* Category 1: General Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-luxury-gold-600 pb-1 border-b border-luxury-brown-100/50">
                  1. General & Brand Identity
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">Owner Name</span>
                    <span className="font-semibold text-luxury-brown-950">{viewingHotel.ownerName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">Email Address</span>
                    <span className="font-mono text-luxury-brown-950">{viewingHotel.emailAddress || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">Mobile Number</span>
                    <span className="font-mono text-luxury-brown-950">{viewingHotel.phoneNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">WhatsApp Number</span>
                    <span className="font-mono text-luxury-brown-950">{viewingHotel.whatsappNumber || 'N/A'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">Address</span>
                    <span className="text-luxury-brown-800">{viewingHotel.address || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Category 2: Legal & Localisation */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-luxury-gold-600 pb-1 border-b border-luxury-brown-100/50">
                  2. Financial, Legal & Localisation
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">GST Number</span>
                    <span className="font-mono text-luxury-brown-950 uppercase">{viewingHotel.gstNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">PAN Number</span>
                    <span className="font-mono text-luxury-brown-950 uppercase">{viewingHotel.panNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">Currency</span>
                    <span className="text-luxury-brown-950 font-medium">{viewingHotel.currency || 'INR (₹)'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">Time Zone</span>
                    <span className="text-luxury-brown-950 font-medium">{viewingHotel.timeZone || 'Asia/Kolkata (IST)'}</span>
                  </div>
                </div>
              </div>

              {/* Category 3: System & SMTP Config */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-luxury-gold-600 pb-1 border-b border-luxury-brown-100/50">
                  3. System Integrations & SMTP Config
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-luxury-beige-50/50 p-4 rounded-2xl border border-luxury-brown-100/30">
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">SMTP Host</span>
                    <span className="font-mono text-luxury-brown-950">{viewingHotel.emailSettings?.host || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">SMTP Port</span>
                    <span className="font-mono text-luxury-brown-950">{viewingHotel.emailSettings?.port || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">SMTP Username</span>
                    <span className="font-mono text-luxury-brown-950">{viewingHotel.emailSettings?.user || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">SMTP Password Status</span>
                    <span className="text-emerald-700 font-bold">
                      {viewingHotel.emailSettings?.pass ? '✓ Configured & Encrypted' : 'Not Configured'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">SMTP SSL/TLS Secure</span>
                    <span className="text-luxury-brown-950 font-medium">{viewingHotel.emailSettings?.secure ? 'True (SSL)' : 'False (Non-secure)'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">Invoice Prefix</span>
                    <span className="font-mono font-bold text-luxury-gold-700">{viewingHotel.invoicePrefix || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-luxury-brown-400 block uppercase font-mono">Room Tier Limit</span>
                    <span className="font-mono font-bold text-luxury-brown-950">{viewingHotel.roomTierLimit || '1-10'} rooms capacity</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-luxury-beige-50/50 border-t border-luxury-brown-100 flex gap-3">
              <button
                onClick={() => {
                  setEditingHotel(viewingHotel);
                  setViewingHotel(null);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-luxury-brown-900 hover:bg-luxury-brown-950 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
              >
                <Edit className="w-4 h-4 text-luxury-gold-400" /> Edit Hotel Profile
              </button>
              <button
                onClick={() => setViewingHotel(null)}
                className="flex-1 border border-luxury-brown-200 text-luxury-brown-700 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-white transition-all cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editingHotel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 flex justify-between items-center border-b border-luxury-gold-500/10">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-luxury-gold-400" />
                <h3 className="font-serif font-bold text-lg">Modify Tenant Property Profile</h3>
              </div>
              <button 
                onClick={() => setEditingHotel(null)}
                className="p-1.5 hover:bg-luxury-brown-800 rounded-lg text-luxury-brown-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveProfile(editingHotel);
              }}
              className="p-6 space-y-6 max-h-[70vh] overflow-y-auto text-sm"
            >
              {/* Category 1: General Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-luxury-gold-600 pb-1 border-b border-luxury-brown-100/50">
                  1. General & Brand Identity
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Hotel Name *</label>
                    <input 
                      type="text" 
                      required
                      value={editingHotel.name || ''}
                      onChange={(e) => setEditingHotel({ ...editingHotel, name: e.target.value })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Owner Name</label>
                    <input 
                      type="text" 
                      value={editingHotel.ownerName || ''}
                      onChange={(e) => setEditingHotel({ ...editingHotel, ownerName: e.target.value })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Email Address</label>
                    <input 
                      type="email" 
                      value={editingHotel.emailAddress || ''}
                      onChange={(e) => setEditingHotel({ ...editingHotel, emailAddress: e.target.value })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Mobile Phone Number</label>
                    <input 
                      type="text" 
                      value={editingHotel.phoneNumber || ''}
                      onChange={(e) => setEditingHotel({ ...editingHotel, phoneNumber: e.target.value })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">WhatsApp Number</label>
                    <input 
                      type="text" 
                      value={editingHotel.whatsappNumber || ''}
                      onChange={(e) => setEditingHotel({ ...editingHotel, whatsappNumber: e.target.value })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Logo URL</label>
                    <input 
                      type="text" 
                      value={editingHotel.logoUrl || ''}
                      onChange={(e) => setEditingHotel({ ...editingHotel, logoUrl: e.target.value })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Admin Username *</label>
                    <input 
                      type="text" 
                      required
                      value={editingHotel.username || ''}
                      onChange={(e) => setEditingHotel({ ...editingHotel, username: e.target.value })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Admin Password *</label>
                    <input 
                      type="password" 
                      required
                      value={editingHotel.password || ''}
                      onChange={(e) => setEditingHotel({ ...editingHotel, password: e.target.value })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Approval & Operational Status *</label>
                    <select
                      value={editingHotel.status || 'Approved'}
                      onChange={(e) => {
                        const newStatus = e.target.value as 'Approved' | 'Pending' | 'Suspended' | 'Rejected';
                        setEditingHotel({ 
                          ...editingHotel, 
                          status: newStatus,
                          subscriptionStatus: newStatus === 'Approved' ? 'Active' : editingHotel.subscriptionStatus
                        });
                      }}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-bold"
                    >
                      <option value="Approved">Approved (Active Access Authorized)</option>
                      <option value="Pending">Pending (Awaiting Super Admin Verification)</option>
                      <option value="Suspended">Suspended (Access Temporarily Paused)</option>
                      <option value="Rejected">Rejected (Access Deactivated)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Address</label>
                    <textarea 
                      rows={2}
                      value={editingHotel.address || ''}
                      onChange={(e) => setEditingHotel({ ...editingHotel, address: e.target.value })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Category 2: Legal & Localisation */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-luxury-gold-600 pb-1 border-b border-luxury-brown-100/50">
                  2. Financial, Legal & Localisation
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">GST Number</label>
                    <input 
                      type="text" 
                      value={editingHotel.gstNumber || ''}
                      onChange={(e) => setEditingHotel({ ...editingHotel, gstNumber: e.target.value.toUpperCase() })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">PAN Number</label>
                    <input 
                      type="text" 
                      value={editingHotel.panNumber || ''}
                      onChange={(e) => setEditingHotel({ ...editingHotel, panNumber: e.target.value.toUpperCase() })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Currency Display</label>
                    <input 
                      type="text" 
                      value={editingHotel.currency || ''}
                      placeholder="e.g. INR (₹)"
                      onChange={(e) => setEditingHotel({ ...editingHotel, currency: e.target.value })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">Time Zone</label>
                    <input 
                      type="text" 
                      value={editingHotel.timeZone || ''}
                      placeholder="e.g. Asia/Kolkata (IST)"
                      onChange={(e) => setEditingHotel({ ...editingHotel, timeZone: e.target.value })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">External Payment Link (for Membership Renewal)</label>
                    <input 
                      type="url" 
                      value={editingHotel.externalPaymentLink || ''}
                      placeholder="https://example.com/pay"
                      onChange={(e) => setEditingHotel({ ...editingHotel, externalPaymentLink: e.target.value })}
                      className="w-full text-sm bg-luxury-beige-100/50 border border-[#8C7355]/20 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Category 3: System Config */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-luxury-gold-600 pb-1 border-b border-luxury-brown-100/50">
                  3. SMTP & Invoicing Configuration
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-luxury-beige-50/50 p-4 rounded-2xl border border-luxury-brown-100/30">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">SMTP Host</label>
                    <input 
                      type="text" 
                      value={editingHotel.emailSettings?.host || ''}
                      onChange={(e) => setEditingHotel({
                        ...editingHotel,
                        emailSettings: { ...editingHotel.emailSettings, host: e.target.value }
                      })}
                      className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">SMTP Port</label>
                    <input 
                      type="number" 
                      value={editingHotel.emailSettings?.port || ''}
                      onChange={(e) => setEditingHotel({
                        ...editingHotel,
                        emailSettings: { ...editingHotel.emailSettings, port: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">SMTP Username</label>
                    <input 
                      type="text" 
                      value={editingHotel.emailSettings?.user || ''}
                      onChange={(e) => setEditingHotel({
                        ...editingHotel,
                        emailSettings: { ...editingHotel.emailSettings, user: e.target.value }
                      })}
                      className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-luxury-brown-700 block">SMTP Password</label>
                    <input 
                      type="password" 
                      value={editingHotel.emailSettings?.pass || ''}
                      placeholder="••••••••"
                      onChange={(e) => setEditingHotel({
                        ...editingHotel,
                        emailSettings: { ...editingHotel.emailSettings, pass: e.target.value }
                      })}
                      className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2 sm:col-span-2 pt-1">
                    <input 
                      type="checkbox" 
                      id="smtp-secure"
                      checked={!!editingHotel.emailSettings?.secure}
                      onChange={(e) => setEditingHotel({
                        ...editingHotel,
                        emailSettings: { ...editingHotel.emailSettings, secure: e.target.checked }
                      })}
                      className="rounded border-luxury-brown-300 text-luxury-gold-600 focus:ring-luxury-gold-500"
                    />
                    <label htmlFor="smtp-secure" className="text-xs font-semibold text-luxury-brown-700 cursor-pointer">
                      Use Secure Connection (SSL/TLS Encrypted Tunnel)
                    </label>
                  </div>

                  <div className="space-y-1 sm:col-span-2 border-t border-luxury-brown-100/30 pt-3 mt-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-luxury-brown-700 block">Invoice Prefix</label>
                        <input 
                          type="text" 
                          value={editingHotel.invoicePrefix || ''}
                          placeholder="e.g. RHR"
                          onChange={(e) => setEditingHotel({ ...editingHotel, invoicePrefix: e.target.value.toUpperCase() })}
                          className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono font-bold uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-luxury-brown-700 block">Room Size Capacity Tier</label>
                        <select 
                          value={editingHotel.roomTierLimit || '1-10'}
                          onChange={(e) => setEditingHotel({ ...editingHotel, roomTierLimit: e.target.value as any })}
                          className="w-full text-sm bg-white border border-luxury-brown-100 rounded-xl px-4 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                        >
                          <option value="1-10">1 to 10 Rooms</option>
                          <option value="10-20">10 to 20 Rooms</option>
                          <option value="20-30">20 to 30 Rooms</option>
                          <option value="30-50">30 to 50 Rooms</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingHotel(null)}
                  className="flex-1 border border-luxury-brown-200 text-luxury-brown-700 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-luxury-beige-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold py-2.5 px-4 rounded-xl text-xs shadow-md shadow-luxury-gold-500/5 transition-all cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Package Modal */}
      {packageChangingHotel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 flex justify-between items-center border-b border-luxury-gold-500/10">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-luxury-gold-400" />
                <h3 className="font-serif font-bold text-lg">Change Subscription Package</h3>
              </div>
              <button 
                onClick={() => setPackageChangingHotel(null)}
                className="p-1.5 hover:bg-luxury-brown-800 rounded-lg text-luxury-brown-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-luxury-brown-600">
                Update the active package plan for <strong className="text-luxury-brown-950">{packageChangingHotel.name}</strong>. Changing the package resets the pricing and extends the validity.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { plan: 'Trial', name: 'Free Trial', price: '₹0 (7 Days)' },
                  { plan: 'Monthly', name: 'Monthly Pro', price: '₹1,899 (30 Days)' },
                  { plan: 'HalfYearly', name: '6-Month Plan', price: '₹7,999 (180 Days)' },
                  { plan: 'Yearly', name: 'Yearly Enterprise', price: '₹14,000 (365 Days)' }
                ].map(p => (
                  <button
                    key={p.plan}
                    onClick={() => handleChangePackage(packageChangingHotel.id, p.plan as any)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      packageChangingHotel.subscriptionPlan === p.plan 
                        ? 'border-luxury-gold-500 bg-luxury-gold-500/10 shadow-xs' 
                        : 'border-luxury-brown-100 hover:bg-luxury-beige-50'
                    }`}
                  >
                    <span className="block text-xs font-bold text-luxury-brown-950">{p.name}</span>
                    <span className="text-[10px] text-luxury-brown-500 font-mono">{p.price}</span>
                  </button>
                ))}
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  onClick={() => setPackageChangingHotel(null)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 rounded-lg text-xs hover:bg-luxury-beige-50 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Package Modal */}
      {showPackageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in my-8">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 flex justify-between items-center border-b border-luxury-gold-500/10">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-luxury-gold-400" />
                <div>
                  <h3 className="font-serif font-bold text-lg">{editingPackageId ? 'Edit Package Plan & Module Rules' : 'Create New Subscription Package'}</h3>
                  <p className="text-[11px] text-luxury-brown-300">Set room capacity limits and select module permissions for hotels on this plan.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPackageModal(false)}
                className="p-1.5 hover:bg-luxury-brown-800 rounded-lg text-luxury-brown-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePackage} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Package Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-luxury-brown-800 mb-1">Package Name *</label>
                  <input
                    type="text"
                    required
                    value={pkgFormName}
                    onChange={(e) => setPkgFormName(e.target.value)}
                    placeholder="e.g. Starter, Growth, Premium, Enterprise"
                    className="w-full px-3 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-luxury-brown-800 mb-1">Badge Tag / Highlight</label>
                  <input
                    type="text"
                    value={pkgFormBadge}
                    onChange={(e) => setPkgFormBadge(e.target.value)}
                    placeholder="e.g. Most Popular, Best Value, Starter"
                    className="w-full px-3 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-luxury-brown-800 mb-1">Package Tagline / Short Summary</label>
                <input
                  type="text"
                  value={pkgFormTagline}
                  onChange={(e) => setPkgFormTagline(e.target.value)}
                  placeholder="e.g. Comprehensive PMS package with Staff Roster and Cash Vaults"
                  className="w-full px-3 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500 outline-none"
                />
              </div>

              {/* Pricing & Room Limits */}
              <div className="bg-luxury-beige-50/80 p-4 rounded-2xl border border-luxury-brown-100 space-y-4">
                <h4 className="text-xs font-mono uppercase font-bold text-luxury-brown-900 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-luxury-gold-600" /> Pricing & Capacity Constraints
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-luxury-brown-800 mb-1">Monthly Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={pkgFormPriceMonthly}
                      onChange={(e) => setPkgFormPriceMonthly(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-luxury-brown-800 mb-1">Yearly Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={pkgFormPriceYearly}
                      onChange={(e) => setPkgFormPriceYearly(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-luxury-brown-800 mb-1">Max Room Capacity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="9999"
                      value={pkgFormMaxRooms}
                      onChange={(e) => setPkgFormMaxRooms(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500 outline-none font-mono font-bold text-luxury-brown-950"
                    />
                  </div>
                </div>

                {/* Quick Room Limit Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] font-mono text-luxury-brown-500">Quick Presets:</span>
                  {[
                    { rooms: 15, label: '15 Rooms (Starter)' },
                    { rooms: 35, label: '35 Rooms (Growth)' },
                    { rooms: 75, label: '75 Rooms (Luxury)' },
                    { rooms: 9999, label: 'Unlimited Rooms' }
                  ].map(p => (
                    <button
                      key={p.rooms}
                      type="button"
                      onClick={() => setPkgFormMaxRooms(p.rooms)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        pkgFormMaxRooms === p.rooms 
                          ? 'bg-luxury-brown-900 text-luxury-gold-300' 
                          : 'bg-white border border-luxury-brown-200 text-luxury-brown-700 hover:bg-luxury-beige-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Module Feature Access Section */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-mono uppercase font-bold text-luxury-brown-900 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-luxury-gold-600" /> Granular Module Permissions
                  </h4>
                  <p className="text-[11px] text-luxury-brown-500">Select which operational modules are accessible to hotel properties enrolled in this package.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* OTA Channel Sync */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${pkgFormModules.ota ? 'bg-emerald-50/50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={pkgFormModules.ota}
                      onChange={(e) => setPkgFormModules({ ...pkgFormModules, ota: e.target.checked })}
                      className="mt-1 rounded text-luxury-gold-500 focus:ring-luxury-gold-500 h-4 w-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-luxury-brown-950 block flex items-center gap-1">
                        🔌 OTA Channel Manager
                        {!pkgFormModules.ota && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-mono font-normal">Restricted</span>}
                      </span>
                      <p className="text-[10px] text-luxury-brown-600">Connect Agoda, Booking.com, MMT OTA channels. (Not for everyone - restricted to higher tiers).</p>
                    </div>
                  </label>

                  {/* Staff Management */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${pkgFormModules.staff ? 'bg-emerald-50/50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={pkgFormModules.staff}
                      onChange={(e) => setPkgFormModules({ ...pkgFormModules, staff: e.target.checked })}
                      className="mt-1 rounded text-luxury-gold-500 focus:ring-luxury-gold-500 h-4 w-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-luxury-brown-950 block flex items-center gap-1">
                        👥 Staff Management & Roster
                        {!pkgFormModules.staff && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-mono font-normal">Restricted</span>}
                      </span>
                      <p className="text-[10px] text-luxury-brown-600">Add staff logins, roles, designations, shift logs & department access. (Not for everyone).</p>
                    </div>
                  </label>

                  {/* Reports & Analytics */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${pkgFormModules.reports ? 'bg-emerald-50/50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={pkgFormModules.reports}
                      onChange={(e) => setPkgFormModules({ ...pkgFormModules, reports: e.target.checked })}
                      className="mt-1 rounded text-luxury-gold-500 focus:ring-luxury-gold-500 h-4 w-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-luxury-brown-950 block">📊 Daily & Financial Reports</span>
                      <p className="text-[10px] text-luxury-brown-600">Revenue breakdowns, occupancy percentages, and daily PDF reports.</p>
                    </div>
                  </label>

                  {/* Cash Handover */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${pkgFormModules.cashHandover ? 'bg-emerald-50/50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={pkgFormModules.cashHandover}
                      onChange={(e) => setPkgFormModules({ ...pkgFormModules, cashHandover: e.target.checked })}
                      className="mt-1 rounded text-luxury-gold-500 focus:ring-luxury-gold-500 h-4 w-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-luxury-brown-950 block">💸 Cash Handover & Shift Vault</span>
                      <p className="text-[10px] text-luxury-brown-600">Physical cash tallying and shift handover logging.</p>
                    </div>
                  </label>

                  {/* Expense Accounting */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${pkgFormModules.expenses ? 'bg-emerald-50/50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={pkgFormModules.expenses}
                      onChange={(e) => setPkgFormModules({ ...pkgFormModules, expenses: e.target.checked })}
                      className="mt-1 rounded text-luxury-gold-500 focus:ring-luxury-gold-500 h-4 w-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-luxury-brown-950 block">💰 Expense Manager</span>
                      <p className="text-[10px] text-luxury-brown-600">Log vendor receipts, maintenance slips, and labor payouts.</p>
                    </div>
                  </label>

                  {/* GST Invoices */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${pkgFormModules.invoices ? 'bg-emerald-50/50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={pkgFormModules.invoices}
                      onChange={(e) => setPkgFormModules({ ...pkgFormModules, invoices: e.target.checked })}
                      className="mt-1 rounded text-luxury-gold-500 focus:ring-luxury-gold-500 h-4 w-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-luxury-brown-950 block">🧾 GST Invoices & Billing Engine</span>
                      <p className="text-[10px] text-luxury-brown-600">Printable guest tax invoices with custom GST breakdowns.</p>
                    </div>
                  </label>

                  {/* House Policies */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${pkgFormModules.policies ? 'bg-emerald-50/50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={pkgFormModules.policies}
                      onChange={(e) => setPkgFormModules({ ...pkgFormModules, policies: e.target.checked })}
                      className="mt-1 rounded text-luxury-gold-500 focus:ring-luxury-gold-500 h-4 w-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-luxury-brown-950 block">📋 House Rules & Policy Manager</span>
                      <p className="text-[10px] text-luxury-brown-600">Define check-in terms, cancellation policies, and printable rules.</p>
                    </div>
                  </label>

                  {/* Direct Website */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${pkgFormModules.website ? 'bg-emerald-50/50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={pkgFormModules.website}
                      onChange={(e) => setPkgFormModules({ ...pkgFormModules, website: e.target.checked })}
                      className="mt-1 rounded text-luxury-gold-500 focus:ring-luxury-gold-500 h-4 w-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-luxury-brown-950 block">🌐 Direct Booking Website Engine</span>
                      <p className="text-[10px] text-luxury-brown-600">Public direct booking portal for guest room reservations.</p>
                    </div>
                  </label>

                  {/* POS Terminal */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${pkgFormModules.pos ? 'bg-emerald-50/50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={pkgFormModules.pos || false}
                      onChange={(e) => setPkgFormModules({ ...pkgFormModules, pos: e.target.checked })}
                      className="mt-1 rounded text-luxury-gold-500 focus:ring-luxury-gold-500 h-4 w-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-luxury-brown-950 block flex items-center gap-1">
                        🍽️ POS Terminal & Restaurant Billing
                        {!pkgFormModules.pos && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-mono font-normal">Restricted</span>}
                      </span>
                      <p className="text-[10px] text-luxury-brown-600">Restaurant & room service food order billing with live table management.</p>
                    </div>
                  </label>

                  {/* Inventory Store */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${pkgFormModules.inventory ? 'bg-emerald-50/50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={pkgFormModules.inventory || false}
                      onChange={(e) => setPkgFormModules({ ...pkgFormModules, inventory: e.target.checked })}
                      className="mt-1 rounded text-luxury-gold-500 focus:ring-luxury-gold-500 h-4 w-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-luxury-brown-950 block flex items-center gap-1">
                        🛒 Inventory Store & Stock Management
                        {!pkgFormModules.inventory && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-mono font-normal">Restricted</span>}
                      </span>
                      <p className="text-[10px] text-luxury-brown-600">Stock In, Stock Out, supplier purchase orders and low stock warnings.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-luxury-brown-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPackageModal(false)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 rounded-xl text-xs font-medium hover:bg-luxury-beige-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-luxury-brown-950 hover:bg-black text-luxury-gold-300 rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4 text-luxury-gold-400" /> Save Package Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Package Modal */}
      {assignPkgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in my-8">
            <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 flex justify-between items-center border-b border-luxury-gold-500/10">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-luxury-gold-400" />
                <h3 className="font-serif font-bold text-lg">Assign "{assignPkgModal.name}" to Hotels</h3>
              </div>
              <button 
                onClick={() => setAssignPkgModal(null)}
                className="p-1.5 hover:bg-luxury-brown-800 rounded-lg text-luxury-brown-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-luxury-brown-600">
                Select which hotel properties should be enrolled in the <strong>{assignPkgModal.name}</strong> package ({assignPkgModal.maxRooms >= 999 ? 'Unlimited Rooms' : `Up to ${assignPkgModal.maxRooms} Rooms`}).
              </p>

              <div className="space-y-2">
                {hotels.map(h => {
                  const isAssigned = h.packageId === assignPkgModal.id;
                  return (
                    <div 
                      key={h.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${isAssigned ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-luxury-brown-100 hover:bg-luxury-beige-50'}`}
                    >
                      <div>
                        <h4 className="text-xs font-bold text-luxury-brown-950">{h.name}</h4>
                        <span className="text-[10px] text-luxury-brown-500 font-mono">
                          Current Plan: {packagesList.find(p => p.id === h.packageId)?.name || h.subscriptionPlan || 'Default'}
                        </span>
                      </div>

                      {isAssigned ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Enrolled
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAssignPackageToHotel(h.id, assignPkgModal)}
                          className="px-3 py-1.5 bg-luxury-brown-900 hover:bg-black text-luxury-gold-300 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Enroll Hotel
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-luxury-brown-100 flex justify-end">
                <button
                  onClick={() => setAssignPkgModal(null)}
                  className="px-4 py-2 bg-luxury-brown-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SuperAdmin Renewal Approval, Package Selection & Invoice Generator Modal */}
      {renewalModalHotel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in my-8">
            <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 flex justify-between items-center border-b border-luxury-gold-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg">
                    Approve Membership Renewal & Generate Invoice
                  </h3>
                  <p className="text-xs text-luxury-gold-300 font-mono">
                    Property: {renewalModalHotel.name} ({renewalModalHotel.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRenewalModalHotel(null)}
                className="p-1.5 hover:bg-luxury-brown-800 rounded-lg text-luxury-brown-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRenewalAndGenerateInvoice} className="p-6 space-y-5 text-xs">
              {renewalModalHotel.renewalRequest?.status === 'Pending' && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-amber-800 block">
                    Incoming Hotel Renewal Request
                  </span>
                  <p className="text-luxury-brown-900">
                    Requested Package: <strong>{renewalModalHotel.renewalRequest.requestedPackageName}</strong> ({renewalModalHotel.renewalRequest.requestedPlan}) • ₹{Number(renewalModalHotel.renewalRequest.requestedAmount || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-[11px] font-mono text-luxury-brown-600">
                    Mode: {renewalModalHotel.renewalRequest.paymentMethod} • Ref: {renewalModalHotel.renewalRequest.transactionReference || 'N/A'}
                  </p>
                </div>
              )}

              {/* 1. Select Package Plan */}
              <div className="space-y-2">
                <label className="font-mono font-bold uppercase text-luxury-brown-800 block">
                  1. Select Package Taken by Hotel *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { plan: 'Monthly' as const, name: 'Monthly Pro Package', price: 1899, days: '30 Days Validity' },
                    { plan: 'HalfYearly' as const, name: '6-Month Growth Package', price: 7999, days: '180 Days Validity' },
                    { plan: 'Yearly' as const, name: '1-Year Enterprise Package', price: 14000, days: '365 Days Validity' },
                  ].map((opt) => {
                    const isSelected = renewalSelectedPlan === opt.plan && !renewalSelectedPkgId;
                    return (
                      <button
                        key={opt.plan}
                        type="button"
                        onClick={() => {
                          setRenewalSelectedPkgId('');
                          setRenewalSelectedPlan(opt.plan);
                          setRenewalSelectedPkgName(opt.name);
                          setRenewalBaseAmount(opt.price);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-luxury-gold-500 bg-luxury-gold-500/15 shadow-xs'
                            : 'border-luxury-brown-200 hover:bg-luxury-beige-50'
                        }`}
                      >
                        <span className="text-[10px] font-mono uppercase text-luxury-gold-700 font-bold block">
                          {opt.days}
                        </span>
                        <span className="font-serif font-bold text-xs text-luxury-brown-950 block mt-0.5">
                          {opt.name}
                        </span>
                        <span className="font-mono font-bold text-sm text-emerald-700 block mt-1">
                          ₹{Number(opt.price || 0).toLocaleString('en-IN')}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {packagesList.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-luxury-brown-500 font-bold block">
                      Or Select Custom SaaS Package Plan:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {packagesList.map((pkg) => {
                        const isSelected = renewalSelectedPkgId === pkg.id;
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => {
                              setRenewalSelectedPkgId(pkg.id);
                              setRenewalSelectedPkgName(pkg.name);
                              setRenewalBaseAmount(
                                renewalSelectedPlan === 'Yearly' ? pkg.priceYearly : pkg.priceMonthly
                              );
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-50/70'
                                : 'border-luxury-brown-200 hover:bg-luxury-beige-50'
                            }`}
                          >
                            <span className="font-bold text-luxury-brown-950 block">{pkg.name}</span>
                            <span className="text-[10px] font-mono text-luxury-brown-600">
                              ₹{pkg.priceMonthly}/mo • ₹{pkg.priceYearly}/yr • Up to {pkg.maxRooms} Rooms
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Package Name, Billing Cycle & Price Customization */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-mono font-bold uppercase text-luxury-brown-700 block mb-1">
                    Package Name on Invoice *
                  </label>
                  <input
                    type="text"
                    required
                    value={renewalSelectedPkgName}
                    onChange={(e) => setRenewalSelectedPkgName(e.target.value)}
                    className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2 font-semibold text-luxury-brown-950"
                  />
                </div>
                <div>
                  <label className="font-mono font-bold uppercase text-luxury-brown-700 block mb-1">
                    Billing Duration *
                  </label>
                  <select
                    value={renewalSelectedPlan}
                    onChange={(e) => setRenewalSelectedPlan(e.target.value as any)}
                    className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2 font-bold text-luxury-brown-950"
                  >
                    <option value="Monthly">Monthly (30 Days)</option>
                    <option value="HalfYearly">6-Month (180 Days)</option>
                    <option value="Yearly">Yearly (365 Days)</option>
                    <option value="Trial">Trial (7 Days)</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono font-bold uppercase text-luxury-brown-700 block mb-1">
                    Base Amount (INR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={renewalBaseAmount}
                    onChange={(e) => setRenewalBaseAmount(Number(e.target.value))}
                    className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono font-bold text-luxury-brown-950"
                  />
                </div>
              </div>

              {/* 3. Payment Method, Reference & GST Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-mono font-bold uppercase text-luxury-brown-700 block mb-1">
                    Payment Method Received
                  </label>
                  <select
                    value={renewalPaymentMethod}
                    onChange={(e) => setRenewalPaymentMethod(e.target.value)}
                    className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2"
                  >
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                    <option value="Cash">Cash Payment</option>
                    <option value="Card / Online">Card / Online Gateway</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono font-bold uppercase text-luxury-brown-700 block mb-1">
                    Transaction / UTR Reference
                  </label>
                  <input
                    type="text"
                    value={renewalTxnRef}
                    onChange={(e) => setRenewalTxnRef(e.target.value)}
                    placeholder="e.g. UTR82910421 / Cash"
                    className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-luxury-beige-50 border border-luxury-brown-100">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-luxury-brown-900">
                  <input
                    type="checkbox"
                    checked={renewalIncludeGst}
                    onChange={(e) => setRenewalIncludeGst(e.target.checked)}
                    className="rounded text-luxury-gold-600 w-4 h-4"
                  />
                  <span>Include 5% GST on Renewal Tax Invoice (2.5% CGST + 2.5% SGST)</span>
                </label>
                <div className="text-right font-mono">
                  <span className="text-[10px] text-luxury-brown-500 block uppercase">Total Invoice Amount</span>
                  <span className="text-base font-bold text-emerald-700">
                    ₹{(
                      Math.max(0, Number(renewalBaseAmount) || 0) +
                      (renewalIncludeGst ? Math.round((Math.max(0, Number(renewalBaseAmount) || 0) * 5) / 100) : 0)
                    ).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-luxury-brown-100">
                <button
                  type="button"
                  onClick={() => setRenewalModalHotel(null)}
                  className="px-4 py-2.5 border border-luxury-brown-200 rounded-xl text-luxury-brown-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve Payment & Generate Renewal Invoice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable SaaS Subscription Renewal Tax Invoice Modal */}
      {activeSubTab === 'leads' && (() => {
        const conversionEvents = getConversionEventsLog();
        const countEvt = (name: string) => conversionEvents.filter((e) => e.eventName === name).length;
        const nowMs = Date.now();
        const isExpiringWithin48h = (expiryStr?: string) => {
          if (!expiryStr) return false;
          const diff = new Date(expiryStr + 'T23:59:59').getTime() - nowMs;
          return diff >= 0 && diff <= 48 * 60 * 60 * 1000;
        };

        const filteredLeads = mergedSalesLeads.filter((l) => {
          if (crmStatusFilter !== 'All' && l.subscriptionStatus !== crmStatusFilter) return false;
          if (crmSourceFilter !== 'All' && (l.leadSource || 'Direct') !== crmSourceFilter) return false;
          if (crmExpiryFilter === 'expiring48h' && !isExpiringWithin48h(l.trialExpiryDate)) return false;
          if (crmExpiryFilter === 'activeTrial') {
            const diff = l.trialExpiryDate ? new Date(l.trialExpiryDate + 'T23:59:59').getTime() - nowMs : -1;
            if (diff < 0 || l.subscriptionStatus === 'Paid Customer') return false;
          }
          if (crmExpiryFilter === 'expired') {
            const diff = l.trialExpiryDate ? new Date(l.trialExpiryDate + 'T23:59:59').getTime() - nowMs : 1;
            if (diff >= 0 && l.subscriptionStatus !== 'Trial Expired') return false;
          }
          if (crmDateFrom || crmDateTo) {
            const rawDate = String(
              l.registrationDate ||
                l.trialStartDate ||
                (l.demoBookingDateTime ? l.demoBookingDateTime.slice(0, 10) : '') ||
                ''
            ).slice(0, 10);
            if (crmDateFrom && (!rawDate || rawDate < crmDateFrom)) return false;
            if (crmDateTo && (!rawDate || rawDate > crmDateTo)) return false;
          }
          if (crmSearch.trim()) {
            const q = crmSearch.toLowerCase();
            return (
              (l.name || '').toLowerCase().includes(q) ||
              (l.hotelName || '').toLowerCase().includes(q) ||
              (l.phone || '').toLowerCase().includes(q) ||
              (l.email || '').toLowerCase().includes(q) ||
              (l.city || '').toLowerCase().includes(q)
            );
          }
          return true;
        });

        const allFilteredIds = filteredLeads.map((l) => l.id);
        const allFilteredSelected =
          allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedLeadIds.includes(id));

        const expiring48hCount = mergedSalesLeads.filter((l) => isExpiringWithin48h(l.trialExpiryDate) && l.subscriptionStatus !== 'Paid Customer').length;

        return (
          <div className="space-y-6 animate-fade-in">
            {/* Salesperson CRM & Conversion Analytics Header */}
            <div className="bg-gradient-to-r from-luxury-brown-950 via-luxury-brown-900 to-[#140D09] text-white p-6 rounded-2xl border border-luxury-gold-500/30 shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-luxury-gold-400 font-bold block">
                  Meta Ads, Trial Onboarding &amp; Annual Subscription Conversion Hub
                </span>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white">
                  Salesperson Dashboard, Trial Follow-Up &amp; Lead Management
                </h2>
                <p className="text-xs text-luxury-brown-200 max-w-2xl">
                  Track 7-day free trial registrations, Calendly 15-minute demo bookings, 48-hour expiry alerts, and automated trial follow-up communications to convert trial hotels into annual subscribers.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-mono">
                  ⚠️ Expiring &lt; 48h: <strong className="text-white">{expiring48hCount}</strong>
                </div>
                <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-mono">
                  Total Leads: <strong className="text-white">{mergedSalesLeads.length}</strong>
                </div>
              </div>
            </div>

            {/* Section 9: Analytics & Conversion Tracking Funnel Metrics */}
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-luxury-brown-100 pb-3">
                <div>
                  <h3 className="text-sm font-serif font-bold text-luxury-brown-950">
                    Website &amp; Meta Ads Conversion Tracking Funnel (GA4 + Meta Pixel)
                  </h3>
                  <p className="text-xs text-luxury-brown-500">
                    Deduplicated conversion events across landing page visits, free-trial CTAs, Calendly demos, WhatsApp clicks, and verified subscriptions.
                  </p>
                </div>
                <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  Zero Sensitive PII Logged
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center font-mono">
                {[
                  { key: 'landing_page_view', label: 'Landing Views', val: countEvt('landing_page_view') },
                  { key: 'trial_cta_click', label: 'Trial CTA Clicks', val: countEvt('trial_cta_click') },
                  { key: 'trial_registration', label: 'Trial Signups', val: countEvt('trial_registration') },
                  { key: 'demo_booking', label: 'Demo Bookings', val: countEvt('demo_booking') },
                  { key: 'whatsapp_click', label: 'WhatsApp Clicks', val: countEvt('whatsapp_click') },
                  { key: 'pricing_page_view', label: 'Pricing Views', val: countEvt('pricing_page_view') },
                  { key: 'checkout_start', label: 'Checkout Starts', val: countEvt('checkout_start') },
                  { key: 'subscription_purchase', label: 'Paid Purchases', val: countEvt('subscription_purchase') }
                ].map((m) => (
                  <div key={m.key} className="p-3 rounded-xl bg-luxury-beige-50/70 border border-luxury-brown-100">
                    <span className="text-lg font-bold text-luxury-brown-950 block">{m.val}</span>
                    <span className="text-[10px] text-luxury-brown-600 block mt-0.5">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 7: Automated Trial Communication Schedule Reference */}
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-serif font-bold text-luxury-brown-950">
                Automated 7-Day Trial Follow-Up Schedule (Click any stage on a lead row below to dispatch via WhatsApp/Email)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
                {[
                  { day: 'Immediate', title: 'Welcome & Login Details', desc: 'Instant account credentials & dashboard link.' },
                  { day: 'Day 1', title: 'Quick Setup Guide', desc: 'Add rooms, set rates & test first check-in.' },
                  { day: 'Day 3', title: 'Feature Highlight', desc: 'Reservations, GST billing & daily reports.' },
                  { day: 'Day 5', title: 'Trial Reminder + Demo', desc: '2 days left — offer free 15-min specialist call.' },
                  { day: 'Day 6', title: 'Expiry Reminder', desc: 'Final 24h notice + subscription plan options.' },
                  { day: 'Day 7', title: 'Upgrade to Annual Plan', desc: 'Trial expired — upgrade to ₹14,000/yr pack.' }
                ].map((st) => (
                  <div key={st.day} className="p-3 rounded-xl bg-luxury-beige-50/50 border border-luxury-brown-100 space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-luxury-gold-700 block">{st.day}</span>
                    <p className="font-bold text-luxury-brown-950">{st.title}</p>
                    <p className="text-[11px] text-luxury-brown-600 leading-snug">{st.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search Hotel, Owner, Phone, City..."
                  value={crmSearch}
                  onChange={(e) => setCrmSearch(e.target.value)}
                  className="px-3.5 py-2 border border-luxury-brown-200 rounded-xl text-xs w-56"
                />
                <select
                  value={crmStatusFilter}
                  onChange={(e) => setCrmStatusFilter(e.target.value)}
                  aria-label="Filter by Lead Status"
                  className="px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs bg-white font-semibold"
                >
                  <option value="All">All Statuses ({mergedSalesLeads.length})</option>
                  {LEAD_STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
                <select
                  value={crmExpiryFilter}
                  onChange={(e) => setCrmExpiryFilter(e.target.value as any)}
                  aria-label="Filter by Trial Expiry"
                  className="px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs bg-white font-semibold"
                >
                  <option value="all">All Trial Timelines</option>
                  <option value="expiring48h">⚠️ Expiring Within 48 Hours ({expiring48hCount})</option>
                  <option value="activeTrial">Active 7-Day Trials</option>
                  <option value="expired">Expired Trials</option>
                </select>
                <select
                  value={crmSourceFilter}
                  onChange={(e) => setCrmSourceFilter(e.target.value)}
                  aria-label="Filter by Lead Source"
                  className="px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs bg-white font-semibold"
                >
                  <option value="All">All Sources</option>
                  <option value="Meta Ads">Meta Ads</option>
                  <option value="Google">Google</option>
                  <option value="Organic">Organic</option>
                  <option value="Direct">Direct</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Calendly">Calendly</option>
                </select>

                {/* Date Range Filter (From Date / To Date) */}
                <div className="flex flex-wrap items-center gap-1.5 bg-luxury-beige-50/70 px-2.5 py-1 rounded-xl border border-luxury-brown-200">
                  <span className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600">Date:</span>
                  <input
                    type="date"
                    value={crmDateFrom}
                    onChange={(e) => setCrmDateFrom(e.target.value)}
                    title="From Date"
                    className="px-2 py-1 border border-luxury-brown-200 rounded-lg text-xs bg-white font-mono"
                  />
                  <span className="text-[10px] text-luxury-brown-400">to</span>
                  <input
                    type="date"
                    value={crmDateTo}
                    onChange={(e) => setCrmDateTo(e.target.value)}
                    title="To Date"
                    className="px-2 py-1 border border-luxury-brown-200 rounded-lg text-xs bg-white font-mono"
                  />
                  {(crmDateFrom || crmDateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCrmDateFrom('');
                        setCrmDateTo('');
                      }}
                      className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Bulk Delete Option in Filter Bar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkDeleteLeads(selectedLeadIds)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    selectedLeadIds.length > 0
                      ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 shadow-sm'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    Delete Selected{selectedLeadIds.length > 0 ? ` (${selectedLeadIds.length})` : ''}
                  </span>
                </button>
              </div>
            </div>

            {/* Leads CRM Table */}
            <div className="bg-white border border-luxury-brown-100 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-luxury-brown-950 text-white font-mono uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLeadIds(
                                Array.from(new Set([...selectedLeadIds, ...allFilteredIds]))
                              );
                            } else {
                              setSelectedLeadIds(
                                selectedLeadIds.filter((id) => !allFilteredIds.includes(id))
                              );
                            }
                          }}
                          title="Select All Leads"
                          className="w-4 h-4 accent-luxury-gold-500 rounded cursor-pointer"
                        />
                      </th>
                      <th className="p-3.5">Hotel &amp; Contact Person</th>
                      <th className="p-3.5">Source &amp; City</th>
                      <th className="p-3.5">Trial Start / Expiry</th>
                      <th className="p-3.5">Calendly Demo Slot</th>
                      <th className="p-3.5">Lead Status</th>
                      <th className="p-3.5">Salesperson Notes &amp; Next Follow-Up</th>
                      <th className="p-3.5">Automated Follow-Up Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-100">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-luxury-brown-400 font-mono italic">
                          No leads match the selected filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map((lead) => {
                        const expSoon = isExpiringWithin48h(lead.trialExpiryDate) && lead.subscriptionStatus !== 'Paid Customer';
                        const isEditing = editingLeadId === lead.id;
                        const isSelected = selectedLeadIds.includes(lead.id);
                        return (
                          <tr key={lead.id} className={isSelected ? 'bg-rose-50/40' : expSoon ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-luxury-beige-50/40'}>
                            <td className="p-3.5 align-top text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLeadIds((prev) => [...prev, lead.id]);
                                  } else {
                                    setSelectedLeadIds((prev) => prev.filter((id) => id !== lead.id));
                                  }
                                }}
                                className="w-4 h-4 accent-rose-600 rounded cursor-pointer mt-1"
                              />
                            </td>
                            <td className="p-3.5 align-top">
                              <div className="font-serif font-bold text-sm text-luxury-brown-950 flex items-center gap-1.5">
                                <span>{lead.hotelName}</span>
                                {expSoon && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-mono uppercase font-bold">
                                    Expiring &lt; 48h
                                  </span>
                                )}
                              </div>
                              <div className="text-luxury-brown-700 font-semibold mt-0.5">{lead.name}</div>
                              <div className="font-mono text-[11px] text-luxury-brown-500">{lead.phone}</div>
                              {lead.email && <div className="font-mono text-[10px] text-luxury-gold-700">{lead.email}</div>}
                            </td>
                            <td className="p-3.5 align-top font-mono">
                              <span className="px-2 py-0.5 rounded bg-luxury-beige-100 text-luxury-brown-900 font-bold text-[10px]">
                                {lead.leadSource || 'Direct'}
                              </span>
                              <div className="text-[11px] text-luxury-brown-700 mt-1">{lead.city || 'India'}</div>
                              <div className="text-[10px] text-luxury-brown-400">Rooms: {lead.roomsCount || '10-20'}</div>
                            </td>
                            <td className="p-3.5 align-top font-mono text-[11px]">
                              {lead.trialStartDate ? (
                                <>
                                  <div>Start: <strong>{lead.trialStartDate}</strong></div>
                                  <div className={expSoon ? 'text-rose-700 font-bold' : 'text-luxury-brown-800'}>
                                    Expiry: <strong>{lead.trialExpiryDate}</strong>
                                  </div>
                                </>
                              ) : (
                                <span className="text-luxury-brown-400 italic">Demo Lead (No Trial Yet)</span>
                              )}
                              <div className="text-[10px] text-luxury-brown-400 mt-1">
                                Reg: {lead.registrationDate || '—'}
                              </div>
                            </td>
                            <td className="p-3.5 align-top font-mono text-[11px]">
                              {lead.demoBookingDateTime ? (
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold block">
                                  📅 {lead.demoBookingDateTime}
                                </span>
                              ) : (
                                <span className="text-luxury-brown-400 italic">Not Scheduled</span>
                              )}
                            </td>
                            <td className="p-3.5 align-top">
                              <select
                                value={lead.subscriptionStatus || 'New Trial'}
                                onChange={(e) => handleUpdateLeadField(lead, { subscriptionStatus: e.target.value })}
                                aria-label="Lead Status"
                                className="px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-bold bg-white text-luxury-brown-950"
                              >
                                {LEAD_STATUS_OPTIONS.map((st) => (
                                  <option key={st} value={st}>{st}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3.5 align-top max-w-xs">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <textarea
                                    rows={2}
                                    value={leadNoteDraft}
                                    onChange={(e) => setLeadNoteDraft(e.target.value)}
                                    className="w-full p-2 border rounded-lg text-xs"
                                    placeholder="Add salesperson call notes..."
                                  />
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono">Next Call:</span>
                                    <input
                                      type="date"
                                      value={leadNextFollowUpDraft}
                                      onChange={(e) => setLeadNextFollowUpDraft(e.target.value)}
                                      className="p-1 border rounded text-xs font-mono"
                                    />
                                  </div>
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateLeadField(lead, {
                                          salespersonNotes: leadNoteDraft,
                                          nextFollowUpDate: leadNextFollowUpDraft,
                                          followUpHistory: [
                                            {
                                              date: new Date().toISOString(),
                                              stage: 'Salesperson Note',
                                              channel: 'CRM',
                                              summary: leadNoteDraft
                                            },
                                            ...(lead.followUpHistory || [])
                                          ]
                                        });
                                        setEditingLeadId(null);
                                      }}
                                      className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold cursor-pointer"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingLeadId(null)}
                                      className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded text-[11px] cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-xs text-luxury-brown-800">{lead.salespersonNotes || 'No notes yet.'}</p>
                                  <p className="text-[10px] font-mono text-luxury-brown-500">
                                    Next Follow-Up: <strong>{lead.nextFollowUpDate || 'Not set'}</strong>
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingLeadId(lead.id);
                                      setLeadNoteDraft(lead.salespersonNotes || '');
                                      setLeadNextFollowUpDraft(lead.nextFollowUpDate || new Date().toISOString().split('T')[0]);
                                    }}
                                    className="text-[11px] font-mono text-luxury-gold-700 hover:underline font-bold cursor-pointer"
                                  >
                                    ✎ Update Notes / Next Date
                                  </button>
                                  {lead.followUpHistory && lead.followUpHistory.length > 0 && (
                                    <div className="pt-1 border-t border-luxury-brown-100 text-[10px] font-mono text-emerald-700">
                                      Last Action: {lead.followUpHistory[0].stage} ({String(lead.followUpHistory[0].date).substring(0, 10)})
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-3.5 align-top">
                              <div className="flex flex-wrap gap-1 max-w-[230px]">
                                {[
                                  {
                                    stage: 'Day 1 Setup',
                                    msg: `Hi ${lead.name}, welcome to DirectStay PMS for ${lead.hotelName}! Here is your quick Day-1 guide to add rooms, set tariffs, and complete your first guest check-in.`
                                  },
                                  {
                                    stage: 'Day 3 Features',
                                    msg: `Hi ${lead.name}, hope ${lead.hotelName}'s trial is going great! Have you tried GST Billing, Room Matrix Reservations, and Daily Cash Reports yet?`
                                  },
                                  {
                                    stage: 'Day 5 Demo Offer',
                                    msg: `Hi ${lead.name}, your 7-day DirectStay PMS trial for ${lead.hotelName} has 2 days remaining. Would you like a free 15-minute live walkthrough with our specialist?`
                                  },
                                  {
                                    stage: 'Day 6 24h Alert',
                                    msg: `Hi ${lead.name}, reminder: ${lead.hotelName}'s 7-day free trial expires tomorrow. All your hotel data is safe — reply to activate your Monthly (₹1,899) or Annual (₹14,000) plan.`
                                  },
                                  {
                                    stage: 'Day 7 Upgrade',
                                    msg: `Hi ${lead.name}, ${lead.hotelName}'s 7-day trial has concluded. Upgrade to our 1-Year Enterprise Pack (₹14,000 + GST) today to keep uninterrupted access to your PMS.`
                                  }
                                ].map((act) => (
                                  <button
                                    key={act.stage}
                                    type="button"
                                    onClick={() => handleTriggerTrialFollowUp(lead, act.stage, act.msg)}
                                    className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200 text-[10px] font-mono font-bold transition-colors cursor-pointer"
                                  >
                                    {act.stage}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLead(lead)}
                                  className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-[10px] font-mono font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Delete Lead"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      <SubscriptionInvoiceModal
        invoice={viewingSubscriptionInvoice}
        onClose={() => setViewingSubscriptionInvoice(null)}
        businessName={systemWebsite.businessName || 'DirectStay SaaS Hub'}
        supportPhone={systemWebsite.supportPhone}
        supportEmail={systemWebsite.supportEmail}
      />
      {/* Floating Action Toast Notification */}
      {userActionToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-950 text-white border-2 border-emerald-400 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold font-sans tracking-wide">{userActionToast}</span>
          <button onClick={() => setUserActionToast(null)} className="ml-2 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4 text-emerald-300" />
          </button>
        </div>
      )}
    </div>
  );
}
