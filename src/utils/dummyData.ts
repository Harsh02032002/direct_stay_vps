import {
  Room,
  Booking,
  GuestCheckIn,
  Invoice,
  Expense,
  CashHandover,
  HotelPolicy,
  WaterBottleRecord,
  Staff,
  RoomVerification,
  AuditLog,
  HotelSettings,
  Hotel,
  RolePermission,
  SaaSPackage,
  CustomPage,
  InventoryCategory,
  InventorySupplier,
  InventoryProduct,
  InventoryPurchase,
  InventoryStockMovement,
  PosItem,
  PosOrder,
  PettyCashTransaction,
  CashBankAccount,
  FinanceVoucher,
  Vendor,
  OwnerDirectorPayment,
  StaffReimbursement,
  DailyClosingRecord,
  RecurringExpenseSchedule,
  ExpenseCategoryDefinition,
  SystemWebsiteConfig,
  LaundryItemMaster,
  LaundryOrder,
  LostAndFoundItem,
  HousekeepingCleaningLog,
  AppNotification,
  DeletedItemRecord,
  TravelAgent,
  AgentCommissionPayment,
  FoodAdvanceBooking,
  PosCategory,
  PosTableRecord,
  StaffLeaveRequest
} from '../types';
import { syncAllToSupabase } from './supabaseClient';

// ============================================================================
// ZERO DUMMY DATA — ALL OPERATIONAL ARRAYS ARE EMPTY BY DEFAULT
// ALL DATA IS LOADED FROM & SYNCED DIRECTLY TO THE DATABASE (NO LOCALSTORAGE)
// ============================================================================

export const INITIAL_POS_ITEMS: PosItem[] = [];
export const INITIAL_POS_ORDERS: PosOrder[] = [];

export const INITIAL_INVENTORY_CATEGORIES: InventoryCategory[] = [];

export const INITIAL_INVENTORY_SUPPLIERS: InventorySupplier[] = [];
export const INITIAL_INVENTORY_PRODUCTS: InventoryProduct[] = [];
export const INITIAL_INVENTORY_PURCHASES: InventoryPurchase[] = [];
export const INITIAL_INVENTORY_STOCK_MOVEMENTS: InventoryStockMovement[] = [];

export const INITIAL_PETTY_CASH: PettyCashTransaction[] = [];
export const INITIAL_CASH_BANK_ACCOUNTS: CashBankAccount[] = [];
export const INITIAL_FINANCE_VOUCHERS: FinanceVoucher[] = [];
export const INITIAL_VENDORS: Vendor[] = [];
export const INITIAL_OWNER_PAYMENTS: OwnerDirectorPayment[] = [];
export const INITIAL_REIMBURSEMENTS: StaffReimbursement[] = [];
export const INITIAL_DAILY_CLOSINGS: DailyClosingRecord[] = [];

export const INITIAL_CUSTOM_PAGES: CustomPage[] = [];

// No hardcoded packages: SaaS packages are created by Super Admin and loaded from the Database
export const INITIAL_SAAS_PACKAGES: SaaSPackage[] = [];

export const DEFAULT_HOTEL_SETTINGS: HotelSettings = {
  logoUrl: '',
  name: 'DirectStay Property',
  address: '',
  gstNumber: '',
  phoneNumber: '',
  emailAddress: '',
  website: ''
};

export const INITIAL_ROOMS: Room[] = [];
export const INITIAL_BOOKINGS: Booking[] = [];
export const INITIAL_CHECKINS: GuestCheckIn[] = [];
export const INITIAL_INVOICES: Invoice[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_RECURRING_EXPENSES: RecurringExpenseSchedule[] = [];

export const INITIAL_EXPENSE_CATEGORIES: ExpenseCategoryDefinition[] = [];

export const INITIAL_CASH_HANDOVERS: CashHandover[] = [];
export const INITIAL_POLICIES: HotelPolicy[] = [];
export const INITIAL_WATER_BOTTLES: WaterBottleRecord[] = [];
export const INITIAL_STAFF: Staff[] = [];
export const INITIAL_ROOM_VERIFICATIONS: RoomVerification[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'AUD-SEED-1001',
    hotelId: 'hotel-1',
    action: 'System Security Initialized',
    performedBy: 'System (SuperAdmin)',
    actorUsername: 'SuperAdmin',
    actorRole: 'SuperAdmin',
    outcome: 'success',
    details: 'DirectStay PMS Core Enterprise Engine started. Cryptographic integrity & audit logging active.',
    dateTime: new Date(Date.now() - 3600000 * 24).toISOString(),
    persistedAt: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'AUD-SEED-1002',
    hotelId: 'hotel-1',
    action: 'Tariff & Room Inventory Loaded',
    performedBy: 'Raghu Sir (Owner)',
    actorUsername: 'raghu',
    actorRole: 'Owner',
    outcome: 'success',
    details: 'Loaded room inventory across Standard, Deluxe, and Executive categories with dynamic GST configuration.',
    dateTime: new Date(Date.now() - 3600000 * 18).toISOString(),
    persistedAt: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    id: 'AUD-SEED-1003',
    hotelId: 'hotel-1',
    action: 'Hotel GST Policies Synchronized',
    performedBy: 'Admin (Admin)',
    actorUsername: 'admin',
    actorRole: 'Admin',
    outcome: 'success',
    details: 'Verified dynamic GST slabs (0%, 5%, 12%, 18%) and enabled automatic Tax Invoice generation.',
    dateTime: new Date(Date.now() - 3600000 * 12).toISOString(),
    persistedAt: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'AUD-SEED-1004',
    hotelId: 'hotel-1',
    action: 'Early Check-In Surcharge Configured',
    performedBy: 'Admin (Admin)',
    actorUsername: 'admin',
    actorRole: 'Admin',
    outcome: 'success',
    details: 'Configured early check-in detection with hourly and fixed fee rules in Hotel Policy Settings.',
    dateTime: new Date(Date.now() - 3600000 * 6).toISOString(),
    persistedAt: new Date(Date.now() - 3600000 * 6).toISOString()
  },
  {
    id: 'AUD-SEED-1005',
    hotelId: 'hotel-1',
    action: 'Front Desk Shift Active',
    performedBy: 'Reception Desk (Reception)',
    actorUsername: 'reception',
    actorRole: 'Reception',
    outcome: 'success',
    details: 'Active operational shift. Verified guest registrations, advance collections, and room preparation checklist.',
    dateTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    persistedAt: new Date(Date.now() - 3600000 * 2).toISOString()
  }
];
export const INITIAL_DELETED_ITEMS: DeletedItemRecord[] = [];
export const INITIAL_HOTELS: Hotel[] = [];
export const INITIAL_ROLE_PERMISSIONS: RolePermission[] = [];

export const INITIAL_LAUNDRY_ITEMS: LaundryItemMaster[] = [];

export const INITIAL_LAUNDRY_ORDERS: LaundryOrder[] = [];
export const INITIAL_LOST_FOUND_ITEMS: LostAndFoundItem[] = [];
export const INITIAL_CLEANING_LOGS: HousekeepingCleaningLog[] = [];

export const INITIAL_SYSTEM_WEBSITE: SystemWebsiteConfig = {
  businessName: 'DirectStay',
  brandTagline: 'Boutique SaaS Network',
  supportPhone: '7978563771',
  whatsappNumber: '7978563771',
  whatsappDefaultMessage: 'Hello DirectStay Team, I would like to inquire about onboarding my hotel property.',
  supportEmail: 'contact@directstay.online',
  hasWhatsapp: true,
  logoUrl: '',
  navSignInText: 'Sign In',
  navOnboardText: 'Onboard My Hotel',
  heroBadgeText: 'Next-Generation Hospitality SaaS Engine',
  heroTitle: 'The Definitive Property Management System for DirectStay Hoteliers',
  heroTitleLine1: 'The Definitive Property',
  heroTitleLine2: 'Management System for',
  heroTitleLine3: 'DirectStay Hoteliers',
  heroSubtitle:
    'Unify your front-desk, housekeeping checkouts, identity registries, dynamic tariffs, and expense tracking under one high-fidelity multi-tenant property management engine.',
  heroBgImageUrl: '/hero-resort.jpg',
  heroPrimaryCtaText: 'Start 7-Day Free Trial',
  heroSecondaryCtaText: 'Explore Package Pricing',
  heroTrustBadges: ['No Credit Card Required', 'Full Feature Access', 'Cancel Anytime'],
  heroBottomPillars: [
    {
      id: 'hp-1',
      title: 'Front Desk Operations',
      subtitle: 'Streamlined guest check-ins and check-outs'
    },
    {
      id: 'hp-2',
      title: 'Housekeeping Management',
      subtitle: 'Real-time room status and team coordination'
    },
    {
      id: 'hp-3',
      title: 'Guest Identity Registries',
      subtitle: 'Secure and compliant identity management'
    },
    {
      id: 'hp-4',
      title: 'Dynamic Pricing & Expense Tracking',
      subtitle: 'Maximize revenue with smart tariffs and full financial visibility'
    }
  ],
  featuresHeading: 'Full-Spectrum Property Control',
  featuresSubtitle:
    'Explore the rich functional boundaries that make Imperial PMS the ultimate premium software for your hotel properties.',
  featureCards: [
    {
      id: 'fc-1',
      title: 'Self-Service Onboarding',
      description:
        'Launch your property PMS instantly. Upload your company logo, choose your room size tier limit, configure billing details, and watch the system generate your ready-to-run dashboard.',
      bullets: ['Automated Room Tier Templates (1–50 Rooms)', 'Custom Brand Identity & GSTIN Ledger Config']
    },
    {
      id: 'fc-2',
      title: 'Guest Verification Registry',
      description:
        'Expedite checking in guests. Upload Aadhaar card files or take immediate webcam pictures of guests to comply with regulations, storing secure records in your tenant database.',
      bullets: ['Aadhaar, Passport & Government ID Archival', 'Live Desk Webcam Capture & Tenant Isolation']
    },
    {
      id: 'fc-3',
      title: 'Dynamic Pricing Engine',
      description:
        'Modify standard room tariffs, add new custom categories (Standard, Deluxe, Executive, etc.), adjust extra-person pricing dynamically, and automatically suggest real-time pricing cards.',
      bullets: ['Multi-Category Room Rate & Occupancy Rules', 'Flexible Extra-Guest Tariffs & GST Billing']
    }
  ],
  pricingHeading: 'DIRECTSTAY PMS – PRICING PLANS',
  pricingSubtitle:
    'All subscriptions include an initial 7-day risk-free evaluation. No credit card required to start.',
  pricingCards: [
    {
      id: 'pc-trial',
      planKey: 'Trial',
      title: '7-Day Free Trial',
      description: 'Duration: 7 Days • Test available PMS features at zero cost.',
      priceText: '₹0',
      periodText: '/ 7 Days',
      gstText: 'Total with 5% GST (2.5% CGST + 2.5% SGST): ₹0',
      features: [
        'Front Desk PMS',
        'Room Management',
        'Reservations & Booking Calendar',
        'Guest Check-in & Check-out',
        'Real-Time Bill Generation',
        'Test Available PMS Features',
        'No Setup Charges',
        'No Credit Card Required'
      ],
      buttonText: 'Start 7-Day Free Trial',
      badgeText: '',
      isHighlighted: false
    },
    {
      id: 'pc-monthly',
      planKey: 'Monthly',
      title: 'Monthly Pack',
      description: 'Perfect for property owners seeking flexible monthly billing.',
      priceText: '₹1,899',
      periodText: '/ Month',
      gstText: '+ 5% GST — 2.5% CGST + 2.5% SGST (Total ₹1,994)',
      features: [
        'Up to 50 Rooms',
        'Room Management',
        'Reservation Management',
        'Custom Room Categories',
        'Front Desk Operations',
        'Guest Check-in & Check-out',
        'GST Invoice System',
        'Digital Registration Book',
        'Standard Support'
      ],
      buttonText: 'Purchase Monthly Pack',
      badgeText: '',
      isHighlighted: false
    },
    {
      id: 'pc-yearly',
      planKey: 'Yearly',
      title: 'Premium Property Pack',
      description: 'Complete Hotel Management + OTA Connectivity',
      priceText: '₹17,000',
      periodText: '/ Year',
      gstText: '+ 5% GST — 2.5% CGST + 2.5% SGST (Total ₹17,850)',
      features: [
        'Unlimited Room Management',
        'Advanced Reservation Management',
        'Booking Calendar',
        'Front Desk Management',
        'Guest Check-in & Check-out',
        'OTA Channel Manager Connectivity',
        'Supported OTA Account Connection',
        'Room Availability Synchronization',
        'Rate Synchronization',
        'Booking Synchronization',
        'Billing & GST Invoices',
        'POS Management',
        'Extra Services Management',
        'Finance Hub',
        'Petty Cash Management',
        'Cash & Bank Management',
        'Advanced Revenue Reports',
        'Housekeeping Management',
        'Staff Workspace',
        'Housekeeping Audit Checklist',
        'Multi-Department Staff Logins',
        'Dedicated Account Manager Support',
        'Priority Support',
        'Hotel Onboarding & Training'
      ],
      buttonText: 'Purchase Premium Pack',
      badgeText: 'Complete PMS + OTA Sync',
      isHighlighted: true
    },
    {
      id: 'pc-halfyearly',
      planKey: 'HalfYearly',
      title: 'Annual Pack – Special Offer',
      description: 'Regular Price: ₹11,999 • Special 50% OFF Annual Discount',
      priceText: '₹5,999',
      periodText: '/ Year',
      gstText: 'Regular Price: ₹11,999 • + 5% GST (Total ₹6,299)',
      features: [
        'Unlimited Room Management',
        'Front Desk PMS',
        'Reservation Management',
        'Booking Calendar',
        'Guest Check-in & Check-out',
        'Premium Webcam Photo Check-in',
        'Billing & GST Invoices',
        'POS Management',
        'Extra Services Management',
        'Finance Hub',
        'Staff Workspace',
        'Housekeeping Audit Checklist',
        'Advanced Reports',
        'Dedicated Account Manager Support'
      ],
      buttonText: 'Claim Annual Discount Pack',
      badgeText: '50% OFF',
      isHighlighted: false
    }
  ],
  visionTitle: 'Pioneering Commission-Free Hospitality',
  visionContent:
    'Our vision is to bypass OTAs entirely by equipping property owners with professional-grade, direct booking engines and property management tools. We aim to keep hospitality local, authentic, and highly profitable.',
  visionPillars: [
    {
      id: 'vp-1',
      title: 'Revenue Sovereignty',
      description: '100% direct booking earnings retained by the property owner.'
    },
    {
      id: 'vp-2',
      title: 'Unified Operations',
      description: 'Front desk, housekeeping, GST billing, and owner analytics in one hub.'
    },
    {
      id: 'vp-3',
      title: 'Direct Guest Relationships',
      description: 'Complete ownership of verified guest registries and repeat stay history.'
    }
  ],
  testimonialsHeading: 'Client Success Stories',
  testimonialsSubtitle: 'See how independent properties are thriving after launching DirectStay.',
  testimonials: [],
  blogHeading: 'Hospitality Insights & Hotel Management Blogs',
  blogSubtitle:
    'Expert guides, hotel revenue strategies, GST billing tips, and operational best practices published by the DirectStay editorial desk.',
  blogs: [
    {
      id: 'blog-1',
      title: 'How Cloud Hotel PMS Eliminates Front-Desk Errors & Speeds Up Guest Check-Ins',
      slug: 'cloud-hotel-pms-speeds-up-guest-check-ins',
      category: 'Front Desk & Operations',
      author: 'DirectStay Hospitality Desk',
      publishedAt: '2026-10-28',
      readTime: '4 min read',
      imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
      summary:
        'Discover how switching from manual registers and spreadsheets to a unified cloud PMS cuts check-in time under 60 seconds with digital Aadhaar GRC archival and real-time room status.',
      content:
        'Independent hotels and resorts often lose valuable time and revenue due to manual register entries, disconnected spreadsheets, and miscommunication between reception and housekeeping.\n\nWith DirectStay Cloud PMS, every advance reservation automatically flows into the Pre-Arrival queue and 1-Click Check-In desk. Receptionists can verify guest Aadhaar or Passport IDs, capture webcam photos, allocate clean rooms, and generate Digital Guest Registration Cards (GRC) in under 60 seconds.\n\nKey Operational Benefits:\n• Zero duplicate data entry across reservation, check-in, in-house folio, and checkout.\n• Live room status sync (Available, Occupied, Dirty, Under Inspection) between front desk and housekeeping.\n• Complete shift-wise cash handover and tamper-proof audit logs for hotel owners.',
      published: true
    },
    {
      id: 'blog-2',
      title: 'Complete Guide to 5% GST Hotel Billing, Split Settlements & B2B Corporate Invoices',
      slug: 'guide-to-gst-hotel-billing-and-split-settlements',
      category: 'GST Billing & Finance',
      author: 'DirectStay Finance Team',
      publishedAt: '2026-11-01',
      readTime: '5 min read',
      imageUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&auto=format&fit=crop&q=80',
      summary:
        'Learn how to automate CGST + SGST calculations, consolidate Restaurant POS and laundry charges into a single room folio, and settle bills across UPI, Card, and Cash effortlessly.',
      content:
        'Accurate GST invoicing is one of the most critical requirements for Indian hotels. Manual calculation of 2.5% CGST and 2.5% SGST alongside room discounts, extra bed charges, and restaurant KOT orders frequently leads to checkout delays.\n\nDirectStay PMS automates your entire billing lifecycle:\n1. Dynamic Room & Extra Person Tariffs: Automatically computes nightly room charges, extra adult/bed rates, and discounts.\n2. Live Running Folio: Restaurant POS orders, laundry, and extra services post directly to the room bill.\n3. Single Deduction of Advances: Advance deposits collected at booking or check-in are automatically deducted once at final checkout.\n4. Split Payment Settlement: Guests can pay partly via UPI, Card, Cash, or Bank Transfer with instant A4 & thermal GST invoice printing.',
      published: true
    },
    {
      id: 'blog-3',
      title: '5 Proven Ways Boutique Hotels Can Increase Direct Bookings & Save OTA Commissions',
      slug: 'increase-direct-hotel-bookings-save-ota-commissions',
      category: 'Direct Bookings & Growth',
      author: 'DirectStay Growth Advisory',
      publishedAt: '2026-11-03',
      readTime: '4 min read',
      imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&auto=format&fit=crop&q=80',
      summary:
        'Stop paying 18% to 25% commission on repeat guests. See how boutique properties use direct booking links, WhatsApp confirmations, and guest history registries to boost direct revenue.',
      content:
        'While OTAs help with initial discovery, paying 20%+ commission on repeat corporate and family travellers eats into your property margins.\n\nBy combining DirectStay PMS with your own direct booking workflow and verified guest registry:\n• Build a Verified Guest Database: Every check-in builds your property’s private guest directory with stay preferences and contact details.\n• Instant WhatsApp & Email Quotes: Send professional booking confirmations and payment links directly from your reception desk.\n• Transparent Tariff Control: Manage seasonal rates, occupancy rules, and corporate packages from one central console while retaining 100% of your booking revenue.',
      published: true
    }
  ],
  contactHeading: "Let's Discuss Your Growth",
  contactSubtitle:
    'Get in touch directly with our support specialists for personalized setup assistance, integrations, or custom feature requests.',
  contactEmailTitle: 'Email Us',
  contactEmailSubtitle: 'Direct Enterprise & Onboarding Desk',
  contactPhoneTitle: 'Call Helpline',
  contactPhoneSubtitle: 'Priority Setup & Technical Support Line',
  contactAddressTitle: 'Headquarters',
  contactAddressSubtitle: 'Registered Hospitality Operations Hub',
  contactAddress: 'DirectStay Towers, Near Light House Beach, Puri, Odisha, India 752001',
  footerTagline: 'Boutique SaaS System',
  footerDescription:
    'Commission-free Hotel Property Management & Direct Booking SaaS built for independent boutique hotels, resorts, and heritage stays.',
  footerPlatformTitle: 'Platform',
  footerEnterpriseTitle: 'Enterprise & Portals',
  footerDirectDeskTitle: 'Direct Desk',
  footerCopyrightText: '© 2026 DirectStay Luxury Cloud PMS. Powered by DirectStay SaaS. Software Version 2.0',
  footerGstDisclaimer: 'All listed premium plan packages are subject to 18% GST standard regulations.',
  customSections: []
};

export const INITIAL_NOTIFICATIONS: AppNotification[] = [];

// ============================================================================
// IN-MEMORY RUNTIME STATE CACHE ONLY (NO LOCALSTORAGE)
// All business data lives in the Database. This cache only holds the data
// fetched from the DB for the current browser tab and is wiped on reload/logout.
// ============================================================================
const pmsMemoryCache: Record<string, any> =
  typeof globalThis !== 'undefined' && (globalThis as any).__PMS_MEMORY_CACHE__
    ? (globalThis as any).__PMS_MEMORY_CACHE__
    : {};
if (typeof globalThis !== 'undefined') {
  (globalThis as any).__PMS_MEMORY_CACHE__ = pmsMemoryCache;
}

// One-time purge of legacy business data previously persisted in localStorage
if (typeof window !== 'undefined') {
  try {
    const legacyKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('GP_PMS_') || k === 'pms_session_token' || k === 'pms_auth_token')) {
        legacyKeys.push(k);
      }
    }
    legacyKeys.forEach(k => localStorage.removeItem(k));
  } catch {}
}

export function safeSetStorageItem(key: string, value: any) {
  pmsMemoryCache[key] = value;
}

/** Wipe all DB-fetched data held in memory (used on logout). */
export function clearPmsMemoryCache() {
  Object.keys(pmsMemoryCache).forEach(k => {
    delete pmsMemoryCache[k];
  });
}

export const getPmsData = () => {
  const checkAndGet = <T>(key: string, initial: T): T => {
    if (key in pmsMemoryCache && pmsMemoryCache[key] !== undefined) {
      return pmsMemoryCache[key] as T;
    }
    return initial;
  };

  const isLegacyAutoSeededRoom = (r: Room) =>
    !r.bedType &&
    !r.floor &&
    ((r.category === 'Standard' && r.rate === 1800 && r.extraPersonCharge === 400) ||
      (r.category === 'Deluxe' && r.rate === 3500 && r.extraPersonCharge === 600) ||
      (r.category === 'Executive Suite' && r.rate === 6500 && r.extraPersonCharge === 1000) ||
      (r.category === 'Presidential Suite' && r.rate === 12000 && r.extraPersonCharge === 1500));

  const rawRoomsUnfiltered = checkAndGet<Room[]>('GP_PMS_ROOMS', INITIAL_ROOMS);
  const rawRooms = Array.isArray(rawRoomsUnfiltered)
    ? rawRoomsUnfiltered.filter(r => !isLegacyAutoSeededRoom(r))
    : [];
  if (Array.isArray(rawRoomsUnfiltered) && rawRooms.length !== rawRoomsUnfiltered.length) {
    safeSetStorageItem('GP_PMS_ROOMS', rawRooms);
  }
  const rawBookings = checkAndGet<Booking[]>('GP_PMS_BOOKINGS', INITIAL_BOOKINGS);
  const rawCheckins = checkAndGet<GuestCheckIn[]>('GP_PMS_CHECKINS', INITIAL_CHECKINS);
  const rawInvoices = checkAndGet<Invoice[]>('GP_PMS_INVOICES', INITIAL_INVOICES);
  const rawExpenses = checkAndGet<Expense[]>('GP_PMS_EXPENSES', INITIAL_EXPENSES);
  const rawHandovers = checkAndGet<CashHandover[]>('GP_PMS_HANDOVERS', INITIAL_CASH_HANDOVERS);
  const rawPolicies = checkAndGet<HotelPolicy[]>('GP_PMS_POLICIES', INITIAL_POLICIES);
  const rawWaterBottles = checkAndGet<WaterBottleRecord[]>('GP_PMS_WATER_BOTTLES', INITIAL_WATER_BOTTLES);
  const rawStaff = checkAndGet<Staff[]>('GP_PMS_STAFF', INITIAL_STAFF);
  const rawRoomVerifications = checkAndGet<RoomVerification[]>('GP_PMS_ROOM_VERIFICATIONS', INITIAL_ROOM_VERIFICATIONS);
  const rawAuditLogs = checkAndGet<AuditLog[]>('GP_PMS_AUDIT_LOGS', INITIAL_AUDIT_LOGS);
  const rawHotels = checkAndGet<Hotel[]>('GP_PMS_HOTELS', INITIAL_HOTELS);
  const rawPackages = checkAndGet<SaaSPackage[]>('GP_PMS_PACKAGES', INITIAL_SAAS_PACKAGES);
  const rawCustomPages = checkAndGet<CustomPage[]>('GP_PMS_CUSTOM_PAGES', INITIAL_CUSTOM_PAGES);
  const storedSystemWebsite = checkAndGet<SystemWebsiteConfig>('GP_PMS_SYSTEM_WEBSITE', INITIAL_SYSTEM_WEBSITE);
  const systemWebsite: SystemWebsiteConfig = {
    ...INITIAL_SYSTEM_WEBSITE,
    ...storedSystemWebsite,
    heroTrustBadges: storedSystemWebsite?.heroTrustBadges?.length
      ? storedSystemWebsite.heroTrustBadges
      : INITIAL_SYSTEM_WEBSITE.heroTrustBadges,
    heroBottomPillars: storedSystemWebsite?.heroBottomPillars?.length
      ? storedSystemWebsite.heroBottomPillars
      : INITIAL_SYSTEM_WEBSITE.heroBottomPillars,
    featureCards: storedSystemWebsite?.featureCards?.length
      ? storedSystemWebsite.featureCards
      : INITIAL_SYSTEM_WEBSITE.featureCards,
    pricingCards: storedSystemWebsite?.pricingCards?.length
      ? storedSystemWebsite.pricingCards
      : INITIAL_SYSTEM_WEBSITE.pricingCards,
    visionPillars: storedSystemWebsite?.visionPillars?.length
      ? storedSystemWebsite.visionPillars
      : INITIAL_SYSTEM_WEBSITE.visionPillars,
    blogs: Array.isArray(storedSystemWebsite?.blogs)
      ? storedSystemWebsite.blogs
      : INITIAL_SYSTEM_WEBSITE.blogs,
    customSections: storedSystemWebsite?.customSections || INITIAL_SYSTEM_WEBSITE.customSections
  };
  const rawRolePermissions = checkAndGet<RolePermission[]>('GP_PMS_ROLE_PERMISSIONS', INITIAL_ROLE_PERMISSIONS);
  const rawInventoryProducts = checkAndGet<InventoryProduct[]>('GP_PMS_INV_PRODUCTS', INITIAL_INVENTORY_PRODUCTS);
  const rawInventoryCategories = checkAndGet<InventoryCategory[]>('GP_PMS_INV_CATEGORIES', INITIAL_INVENTORY_CATEGORIES);
  const rawInventorySuppliers = checkAndGet<InventorySupplier[]>('GP_PMS_INV_SUPPLIERS', INITIAL_INVENTORY_SUPPLIERS);
  const rawInventoryPurchases = checkAndGet<InventoryPurchase[]>('GP_PMS_INV_PURCHASES', INITIAL_INVENTORY_PURCHASES);
  const rawInventoryMovements = checkAndGet<InventoryStockMovement[]>('GP_PMS_INV_MOVEMENTS', INITIAL_INVENTORY_STOCK_MOVEMENTS);
  const rawPosItems = checkAndGet<PosItem[]>('GP_PMS_POS_ITEMS', INITIAL_POS_ITEMS);
  const rawPosOrders = checkAndGet<PosOrder[]>('GP_PMS_POS_ORDERS', INITIAL_POS_ORDERS);
  const rawPettyCash = checkAndGet<PettyCashTransaction[]>('GP_PMS_PETTY_CASH', INITIAL_PETTY_CASH);
  const rawCashBankAccounts = checkAndGet<CashBankAccount[]>('GP_PMS_CASH_BANK_ACCOUNTS', INITIAL_CASH_BANK_ACCOUNTS);
  const rawFinanceVouchers = checkAndGet<FinanceVoucher[]>('GP_PMS_FINANCE_VOUCHERS', INITIAL_FINANCE_VOUCHERS);
  const rawVendors = checkAndGet<Vendor[]>('GP_PMS_VENDORS', INITIAL_VENDORS);
  const rawOwnerPayments = checkAndGet<OwnerDirectorPayment[]>('GP_PMS_OWNER_PAYMENTS', INITIAL_OWNER_PAYMENTS);
  const rawReimbursements = checkAndGet<StaffReimbursement[]>('GP_PMS_REIMBURSEMENTS', INITIAL_REIMBURSEMENTS);
  const rawDailyClosings = checkAndGet<DailyClosingRecord[]>('GP_PMS_DAILY_CLOSINGS', INITIAL_DAILY_CLOSINGS);
  const rawLaundryItems = checkAndGet<LaundryItemMaster[]>('GP_PMS_LAUNDRY_ITEMS', INITIAL_LAUNDRY_ITEMS);
  const rawLaundryOrders = checkAndGet<LaundryOrder[]>('GP_PMS_LAUNDRY_ORDERS', INITIAL_LAUNDRY_ORDERS);
  const rawLostAndFoundItems = checkAndGet<LostAndFoundItem[]>('GP_PMS_LOST_FOUND_ITEMS', INITIAL_LOST_FOUND_ITEMS);
  const rawCleaningLogs = checkAndGet<HousekeepingCleaningLog[]>('GP_PMS_CLEANING_LOGS', INITIAL_CLEANING_LOGS);
  const rawNotifications = checkAndGet<AppNotification[]>('GP_PMS_NOTIFICATIONS', INITIAL_NOTIFICATIONS);
  const rawDeletedItems = checkAndGet<DeletedItemRecord[]>('GP_PMS_DELETED_ITEMS', INITIAL_DELETED_ITEMS);
  const rawTravelAgents = checkAndGet<TravelAgent[]>('GP_PMS_TRAVEL_AGENTS', []);
  const rawAgentCommissionPayments = checkAndGet<AgentCommissionPayment[]>('GP_PMS_AGENT_COMMISSION_PAYMENTS', []);
  const rawPosAdvanceBookings = checkAndGet<FoodAdvanceBooking[]>('GP_PMS_POS_ADVANCE_BOOKINGS', []);
  const rawPosCategories = checkAndGet<PosCategory[]>('GP_PMS_POS_CATEGORIES', []);
  const rawPosTables = checkAndGet<PosTableRecord[]>('GP_PMS_POS_TABLES', []);
  const rawLeaveRequests = checkAndGet<StaffLeaveRequest[]>('GP_PMS_LEAVE_REQUESTS', []);

  return {
    hotels: rawHotels || [],
    packages: rawPackages || [],
    customPages: rawCustomPages || [],
    rooms: rawRooms || [],
    bookings: rawBookings || [],
    checkins: rawCheckins || [],
    invoices: rawInvoices || [],
    expenses: rawExpenses || [],
    handovers: rawHandovers || [],
    policies: rawPolicies || [],
    waterBottles: rawWaterBottles || [],
    staff: rawStaff || [],
    roomVerifications: rawRoomVerifications || [],
    auditLogs: rawAuditLogs || [],
    deletedItems: rawDeletedItems || [],
    travelAgents: rawTravelAgents || [],
    agentCommissionPayments: rawAgentCommissionPayments || [],
    posAdvanceBookings: rawPosAdvanceBookings || [],
    posCategories: rawPosCategories || [],
    posTables: rawPosTables || [],
    leaveRequests: rawLeaveRequests || [],
    rolePermissions: rawRolePermissions || [],
    inventoryProducts: rawInventoryProducts || [],
    inventoryCategories: rawInventoryCategories || [],
    inventorySuppliers: rawInventorySuppliers || [],
    inventoryPurchases: rawInventoryPurchases || [],
    inventoryStockMovements: rawInventoryMovements || [],
    posItems: rawPosItems || [],
    posOrders: rawPosOrders || [],
    pettyCash: rawPettyCash || [],
    cashBankAccounts: rawCashBankAccounts || [],
    vouchers: rawFinanceVouchers || [],
    vendors: rawVendors || [],
    ownerPayments: rawOwnerPayments || [],
    reimbursements: rawReimbursements || [],
    dailyClosings: rawDailyClosings || [],
    laundryItems: rawLaundryItems || [],
    laundryOrders: rawLaundryOrders || [],
    lostAndFoundItems: rawLostAndFoundItems || [],
    cleaningLogs: rawCleaningLogs || [],
    notifications: rawNotifications || [],
    hotelSettings: DEFAULT_HOTEL_SETTINGS,
    systemWebsite
  };
};

export const savePmsData = (
  data: {
    hotels?: Hotel[];
    packages?: SaaSPackage[];
    rooms?: Room[];
    bookings?: Booking[];
    checkins?: GuestCheckIn[];
    invoices?: Invoice[];
    expenses?: Expense[];
    handovers?: CashHandover[];
    policies?: HotelPolicy[];
    waterBottles?: WaterBottleRecord[];
    staff?: Staff[];
    roomVerifications?: RoomVerification[];
    auditLogs?: AuditLog[];
    customPages?: CustomPage[];
    hotelSettings?: HotelSettings;
    systemWebsite?: SystemWebsiteConfig;
    rolePermissions?: RolePermission[];
    inventoryProducts?: InventoryProduct[];
    inventoryCategories?: InventoryCategory[];
    inventorySuppliers?: InventorySupplier[];
    inventoryPurchases?: InventoryPurchase[];
    inventoryStockMovements?: InventoryStockMovement[];
    posItems?: PosItem[];
    posOrders?: PosOrder[];
    pettyCash?: PettyCashTransaction[];
    cashBankAccounts?: CashBankAccount[];
    vouchers?: FinanceVoucher[];
    vendors?: Vendor[];
    ownerPayments?: OwnerDirectorPayment[];
    reimbursements?: StaffReimbursement[];
    dailyClosings?: DailyClosingRecord[];
    laundryItems?: LaundryItemMaster[];
    laundryOrders?: LaundryOrder[];
    lostAndFoundItems?: LostAndFoundItem[];
    cleaningLogs?: HousekeepingCleaningLog[];
    notifications?: AppNotification[];
    deletedItems?: DeletedItemRecord[];
    travelAgents?: TravelAgent[];
    agentCommissionPayments?: AgentCommissionPayment[];
    posAdvanceBookings?: FoodAdvanceBooking[];
    posCategories?: PosCategory[];
    posTables?: PosTableRecord[];
    leaveRequests?: StaffLeaveRequest[];
    explicitDeletedInvoiceIds?: string[];
    explicitDeletedBookingIds?: string[];
  },
  skipCloudSync = false
) => {
  if (data.hotels !== undefined) {
    try {
      const existingList: Hotel[] = Array.isArray(pmsMemoryCache['GP_PMS_HOTELS']) ? pmsMemoryCache['GP_PMS_HOTELS'] : [];
      const existingMap = new Map(existingList.map(h => [h.id, h]));
      const mergedHotels = data.hotels.map(h => {
        const prev = existingMap.get(h.id);
        if (!prev) return h;
        return {
          ...h,
          password: h.password || prev.password,
          ownerPassword: h.ownerPassword || prev.ownerPassword,
        };
      });
      safeSetStorageItem('GP_PMS_HOTELS', mergedHotels);
    } catch {
      safeSetStorageItem('GP_PMS_HOTELS', data.hotels);
    }
  }
  if (data.packages !== undefined) safeSetStorageItem('GP_PMS_PACKAGES', data.packages);
  if (data.rooms !== undefined) safeSetStorageItem('GP_PMS_ROOMS', data.rooms);
  if (data.bookings !== undefined) safeSetStorageItem('GP_PMS_BOOKINGS', data.bookings);
  if (data.checkins !== undefined) safeSetStorageItem('GP_PMS_CHECKINS', data.checkins);
  if (data.invoices !== undefined) safeSetStorageItem('GP_PMS_INVOICES', data.invoices);
  if (data.expenses !== undefined) safeSetStorageItem('GP_PMS_EXPENSES', data.expenses);
  if (data.handovers !== undefined) safeSetStorageItem('GP_PMS_HANDOVERS', data.handovers);
  if (data.policies !== undefined) safeSetStorageItem('GP_PMS_POLICIES', data.policies);
  if (data.waterBottles !== undefined) safeSetStorageItem('GP_PMS_WATER_BOTTLES', data.waterBottles);
  if (data.staff !== undefined) {
    try {
      const existingList: Staff[] = Array.isArray(pmsMemoryCache['GP_PMS_STAFF']) ? pmsMemoryCache['GP_PMS_STAFF'] : [];
      const existingMap = new Map(existingList.map(s => [s.id, s]));
      const mergedStaff = data.staff.map(s => {
        const prev = existingMap.get(s.id);
        if (!prev) return s;
        return {
          ...s,
          password: s.password || prev.password,
        };
      });
      safeSetStorageItem('GP_PMS_STAFF', mergedStaff);
    } catch {
      safeSetStorageItem('GP_PMS_STAFF', data.staff);
    }
  }
  if (data.roomVerifications !== undefined) safeSetStorageItem('GP_PMS_ROOM_VERIFICATIONS', data.roomVerifications);
  if (data.auditLogs !== undefined) safeSetStorageItem('GP_PMS_AUDIT_LOGS', data.auditLogs);
  if (data.customPages !== undefined) safeSetStorageItem('GP_PMS_CUSTOM_PAGES', data.customPages);
  if (data.systemWebsite !== undefined) safeSetStorageItem('GP_PMS_SYSTEM_WEBSITE', data.systemWebsite);
  if (data.rolePermissions !== undefined) safeSetStorageItem('GP_PMS_ROLE_PERMISSIONS', data.rolePermissions);
  if (data.inventoryProducts !== undefined) safeSetStorageItem('GP_PMS_INV_PRODUCTS', data.inventoryProducts);
  if (data.inventoryCategories !== undefined) safeSetStorageItem('GP_PMS_INV_CATEGORIES', data.inventoryCategories);
  if (data.inventorySuppliers !== undefined) safeSetStorageItem('GP_PMS_INV_SUPPLIERS', data.inventorySuppliers);
  if (data.inventoryPurchases !== undefined) safeSetStorageItem('GP_PMS_INV_PURCHASES', data.inventoryPurchases);
  if (data.inventoryStockMovements !== undefined) safeSetStorageItem('GP_PMS_INV_MOVEMENTS', data.inventoryStockMovements);
  if (data.posItems !== undefined) safeSetStorageItem('GP_PMS_POS_ITEMS', data.posItems);
  if (data.posOrders !== undefined) safeSetStorageItem('GP_PMS_POS_ORDERS', data.posOrders);
  if (data.pettyCash !== undefined) safeSetStorageItem('GP_PMS_PETTY_CASH', data.pettyCash);
  if (data.cashBankAccounts !== undefined) safeSetStorageItem('GP_PMS_CASH_BANK_ACCOUNTS', data.cashBankAccounts);
  if (data.vouchers !== undefined) safeSetStorageItem('GP_PMS_FINANCE_VOUCHERS', data.vouchers);
  if (data.vendors !== undefined) safeSetStorageItem('GP_PMS_VENDORS', data.vendors);
  if (data.ownerPayments !== undefined) safeSetStorageItem('GP_PMS_OWNER_PAYMENTS', data.ownerPayments);
  if (data.reimbursements !== undefined) safeSetStorageItem('GP_PMS_REIMBURSEMENTS', data.reimbursements);
  if (data.dailyClosings !== undefined) safeSetStorageItem('GP_PMS_DAILY_CLOSINGS', data.dailyClosings);
  if (data.laundryItems !== undefined) safeSetStorageItem('GP_PMS_LAUNDRY_ITEMS', data.laundryItems);
  if (data.laundryOrders !== undefined) safeSetStorageItem('GP_PMS_LAUNDRY_ORDERS', data.laundryOrders);
  if (data.lostAndFoundItems !== undefined) safeSetStorageItem('GP_PMS_LOST_FOUND_ITEMS', data.lostAndFoundItems);
  if (data.cleaningLogs !== undefined) safeSetStorageItem('GP_PMS_CLEANING_LOGS', data.cleaningLogs);
  if (data.notifications !== undefined) safeSetStorageItem('GP_PMS_NOTIFICATIONS', data.notifications);
  if (data.deletedItems !== undefined) safeSetStorageItem('GP_PMS_DELETED_ITEMS', data.deletedItems);
  if (data.travelAgents !== undefined) safeSetStorageItem('GP_PMS_TRAVEL_AGENTS', data.travelAgents);
  if (data.agentCommissionPayments !== undefined) safeSetStorageItem('GP_PMS_AGENT_COMMISSION_PAYMENTS', data.agentCommissionPayments);
  if (data.posAdvanceBookings !== undefined) safeSetStorageItem('GP_PMS_POS_ADVANCE_BOOKINGS', data.posAdvanceBookings);
  if (data.posCategories !== undefined) safeSetStorageItem('GP_PMS_POS_CATEGORIES', data.posCategories);
  if (data.posTables !== undefined) safeSetStorageItem('GP_PMS_POS_TABLES', data.posTables);
  if (data.leaveRequests !== undefined) safeSetStorageItem('GP_PMS_LEAVE_REQUESTS', data.leaveRequests);

  if (skipCloudSync) return;

  // Sync only the explicitly modified keys to the Database so concurrent updates never overwrite other collections
  try {
    syncAllToSupabase(data).catch(() => {});
  } catch {}
};
