import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Building, Check, ChevronRight, ChevronDown, ShieldCheck, CreditCard, Sparkles, 
  Upload, Hotel, LogIn, ArrowRight, Star, HelpCircle, Phone, Mail, 
  MapPin, Globe, CheckCircle, RefreshCw, BarChart3, Users, Landmark,
  Quote, Menu, X, Calendar, BedDouble, Receipt, FileSpreadsheet, BookOpen,
  Copy, QrCode, Smartphone, ExternalLink
} from 'lucide-react';
import { Hotel as HotelType, Room, Staff, HotelPolicy, AuditLog, SystemWebsiteConfig, CustomPage, SaaSPackage } from '../types';
import { INITIAL_SYSTEM_WEBSITE, INITIAL_CUSTOM_PAGES, getPmsData } from '../utils/dummyData';
import { sha256 } from '../utils/crypto';
import { showToast } from '../utils/toast';
import {
  PublicSeoPageKey,
  PUBLIC_SEO_PAGES,
  SEO_HOTELIER_GUIDES,
  HotelierGuideArticle,
  applySeoHeadTags,
  trackSeoConversionEvent,
  detectLeadSource,
  isCmsItemPublished,
} from '../utils/seoManager';
import { buildDirectStayWhatsappUrl, DEFAULT_WHATSAPP_NUMBER } from './WhatsAppSupportWidget';
import { sanitizeCmsHtml } from './RichTextEditor';

interface FrontWebsiteProps {
  onOnboardComplete: (newHotel: HotelType, generatedRooms: Room[]) => Promise<{ success: boolean; error?: string }> | void;
  onNavigateToLogin: () => void;
  systemWebsite?: SystemWebsiteConfig;
  customPages?: CustomPage[];
  packages?: SaaSPackage[];
  activeSeoPage?: PublicSeoPageKey;
  activeBlogSlug?: string | null;
  onNavigateSeoPage?: (pageKey: PublicSeoPageKey, blogSlug?: string) => void;
}

type Step = 'branding' | 'inventory' | 'payment' | 'processing';

const HOTEL_PMS_FAQS = [
  {
    q: 'How does the 7-day free trial of DirectStay PMS work?',
    a: 'You get full access to DirectStay Hotel Management Software for 7 days at ₹0 with no credit card required and zero setup charges. You can configure your hotel rooms, record reservations, test check-ins, and generate GST invoices before choosing a paid subscription.'
  },
  {
    q: 'How long does it take to set up DirectStay PMS for my hotel?',
    a: 'Initial property onboarding takes less than 5 minutes. Simply enter your hotel name, GSTIN, contact details, and room tier in our self-service onboarding wizard. Once approved, you can add room categories, base/max occupancy rules, and staff logins immediately.'
  },
  {
    q: 'What features are included in DirectStay Hotel Management Software?',
    a: 'DirectStay includes Hotel Reservation Management, Walk-In & Express Check-In with digital ID/Aadhaar archival (GRC), Room Availability Calendar, Housekeeping & Laundry tracking, Restaurant POS Terminal, Inventory Management, GST Billing & Tax Invoicing, and Daily Financial Reports.'
  },
  {
    q: 'What are the subscription pricing plans after the 7-day free trial?',
    a: 'We offer transparent, flat-rate plans: Monthly Pack at ₹1,899/month (₹2,241 with 18% GST), Annual Pack – Special Offer at ₹5,999/year (50% OFF from ₹11,999; ₹7,079 with 18% GST), and Premium Property Pack with OTA Connectivity at ₹17,000/year (₹17,850 with 5% GST). There are zero per-booking commissions.'
  },
  {
    q: 'Is my hotel and guest data secure and isolated?',
    a: 'Yes. DirectStay uses strict multi-tenant data isolation, SHA-256 encrypted credentials, role-based access control (Owner, Admin, Manager, Reception, Accounts, Housekeeping), and append-only audit logs so your property records remain private and tamper-evident.'
  },
  {
    q: 'Do you provide product demos, onboarding help, and customer support?',
    a: 'Yes! You can book a free live product demonstration or contact our hospitality support desk via phone, WhatsApp, or email for assisted setup, staff training, and technical support.'
  }
];

export default function FrontWebsite({
  onOnboardComplete,
  onNavigateToLogin,
  systemWebsite = INITIAL_SYSTEM_WEBSITE,
  customPages = [],
  packages = [],
  activeSeoPage = 'home',
  onNavigateSeoPage
}: FrontWebsiteProps) {
  const [showWizard, setShowWizard] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.has('onboard') || params.has('step') || params.has('setup');
    }
    return false;
  });
  const [currentStep, setCurrentStep] = useState<Step>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const st = params.get('step');
      if (st === 'inventory' || st === '2') return 'inventory';
      if (st === 'payment' || st === '3') return 'payment';
    }
    return 'branding';
  });
  const [selectedPlan, setSelectedPlan] = useState<'Trial' | 'Monthly' | 'HalfYearly' | 'Yearly'>('Trial');
  const [activeCustomPage, setActiveCustomPage] = useState<CustomPage | null>(null);
  const [activeGuideArticle, setActiveGuideArticle] = useState<HotelierGuideArticle | null>(null);
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Book a Free Demo (Calendly 15-Minute Demo) Modal State
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoHotelName, setDemoHotelName] = useState('');
  const [demoContactName, setDemoContactName] = useState('');
  const [demoEmail, setDemoEmail] = useState('');
  const [demoPhone, setDemoPhone] = useState('');
  const [demoCity, setDemoCity] = useState('');
  const [demoRoomsCount, setDemoRoomsCount] = useState('10-20');
  const [demoDate, setDemoDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().substring(0, 10);
  });
  const [demoPreferredTime, setDemoPreferredTime] = useState('11:00 AM - 11:15 AM IST');
  const [confirmedDemoBooking, setConfirmedDemoBooking] = useState<{
    id: string;
    name: string;
    hotelName: string;
    email: string;
    phone: string;
    city: string;
    rooms: string;
    date: string;
    slot: string;
  } | null>(null);
  const [activeWalkthroughTab, setActiveWalkthroughTab] = useState<'frontdesk' | 'checkin' | 'billing' | 'reports'>('frontdesk');
  const demoName = demoContactName;
  const setDemoName = setDemoContactName;
  const demoRooms = demoRoomsCount;
  const setDemoRooms = setDemoRoomsCount;

  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactHotel, setContactHotel] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactFormTopic, setContactFormTopic] = useState('Product Demo');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const contactFormName = contactName;
  const setContactFormName = setContactName;
  const contactFormHotel = contactHotel;
  const setContactFormHotel = setContactHotel;
  const contactFormPhone = contactPhone;
  const setContactFormPhone = setContactPhone;
  const contactFormMessage = contactMessage;
  const setContactFormMessage = setContactMessage;
  const contactFormSubmitted = contactSubmitted;

  const effectiveCustomPages = customPages && customPages.length > 0 ? customPages : INITIAL_CUSTOM_PAGES;
  const publishedCustomPages = effectiveCustomPages.filter((p) => isCmsItemPublished(p));

  const navigateSeo = (pageKey: PublicSeoPageKey, sectionId?: string) => {
    setMobileMenuOpen(false);
    if (onNavigateSeoPage) {
      onNavigateSeoPage(pageKey);
    } else if (typeof window !== 'undefined') {
      const targetPath = PUBLIC_SEO_PAGES[pageKey]?.path || '/';
      window.history.pushState({}, '', targetPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (sectionId && typeof window !== 'undefined') {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          const navHeight = 68;
          const elementTop = el.getBoundingClientRect().top + window.scrollY - navHeight;
          window.scrollTo({ top: Math.max(0, elementTop), behavior: 'smooth' });
        }
      }, 60);
    }
  };
  const navigateToSeoRoute = navigateSeo;

  const openNamedCustomPage = (keyword: string, fallbackPage: CustomPage) => {
    const match =
      publishedCustomPages.find(
        (p) =>
          p.title.toLowerCase().includes(keyword.toLowerCase()) ||
          p.slug.toLowerCase().includes(keyword.toLowerCase())
      ) || fallbackPage;
    setActiveCustomPage(match);
    setMobileMenuOpen(false);
  };

  const scrollToSection = (sectionId?: string) => {
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      if (window.location.hash) {
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      }
      if (!sectionId) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const el = document.getElementById(sectionId);
      if (el) {
        const navHeight = 64;
        const elementTop = el.getBoundingClientRect().top + window.scrollY - navHeight;
        window.scrollTo({ top: Math.max(0, elementTop), behavior: 'smooth' });
      }
    }
  };

  // Dynamic SEO Title, Meta Description, Canonical URL, OpenGraph & JSON-LD Structured Data
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
    applySeoHeadTags(activeSeoPage, {
      businessName: systemWebsite?.businessName || 'DirectStay',
      supportPhone: systemWebsite?.supportPhone || DEFAULT_WHATSAPP_NUMBER,
      supportEmail: systemWebsite?.supportEmail || 'contact@directstay.online',
      contactAddress: systemWebsite?.contactAddress || 'Puri & Bhubaneswar, Odisha, India',
      logoUrl: systemWebsite?.logoUrl || '',
      seoSettings: systemWebsite?.seoSettings,
      customPage: activeCustomPage || undefined,
    });
    if (activeSeoPage === 'home') {
      trackSeoConversionEvent('landing_page_view', {
        pagePath: '/',
        dedupeKey: 'home_visit'
      });
    } else if (activeSeoPage === 'pricing') {
      trackSeoConversionEvent('pricing_page_view', {
        pagePath: '/pricing/',
        dedupeKey: 'pricing_visit'
      });
    }
  }, [activeSeoPage, systemWebsite, activeCustomPage]);

  // Auto-open custom CMS page if user navigates directly to /page/<slug>
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = window.location.pathname || '';
    if (p.startsWith('/page/')) {
      const slug = p.replace(/^\/page\//, '').replace(/\/+$/, '').toLowerCase();
      if (slug) {
        const matched = publishedCustomPages.find((cp) => (cp.slug || '').toLowerCase() === slug);
        if (matched && activeCustomPage?.id !== matched.id) {
          setActiveCustomPage(matched);
        }
      }
    }
  }, [publishedCustomPages.length]);

  // Onboarding states
  const [ownerFullName, setOwnerFullName] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [hotelCity, setHotelCity] = useState('');
  const [hotelCountry, setHotelCountry] = useState('India');
  const [hotelAddress, setHotelAddress] = useState('');
  const [hotelPhone, setHotelPhone] = useState('');
  const [hotelEmail, setHotelEmail] = useState('');
  const [hotelGst, setHotelGst] = useState('');
  const [hotelWebsite, setHotelWebsite] = useState('');
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Room Inventory Tier Choice
  const [roomTier, setRoomTier] = useState<'1-10' | '10-20' | '20-30' | '30-50'>('1-10');

  // Onboarding UPI Checkout states
  const [onboardUtrRef, setOnboardUtrRef] = useState('');
  const [onboardPayerUpi, setOnboardPayerUpi] = useState('');
  const [onboardUpiError, setOnboardUpiError] = useState('');
  const [onboardQrIdx, setOnboardQrIdx] = useState(0);
  const [onboardCopiedKey, setOnboardCopiedKey] = useState<string | null>(null);

  const onboardUpiId = systemWebsite?.paymentSettings?.upiId?.trim() || '7684023584-4@ybl';
  const onboardUpiPayee =
    systemWebsite?.paymentSettings?.upiPayeeName?.trim() ||
    systemWebsite?.businessName ||
    'DirectStay Hospitality SaaS';

  // Processing animations steps
  const [onboardStatusIndex, setOnboardStatusIndex] = useState(0);
  const [isSubmittingOnboard, setIsSubmittingOnboard] = useState(false);
  const onboardStatuses = [
    'Provisioning isolated cloud tenant workspace...',
    'Generating room registry and pricing templates...',
    'Registering Admin privileges and staff profiles...',
    'Applying subscription pack and GST ledger settings...',
    'Initialization complete! Redirecting to PMS desk...'
  ];

  // Price calculation
  const getPlanDetails = (plan: typeof selectedPlan) => {
    switch (plan) {
      case 'Trial':
        return { name: '7-Day Free Trial', price: 0, period: '7 Days', description: 'Duration: 7 Days • Experience core PMS features with no obligations.' };
      case 'Monthly':
        return { name: 'Monthly Pack', price: 1899, period: 'Month', description: 'Up to 50 Rooms • Front Desk & GST Invoice System.' };
      case 'HalfYearly':
        return { name: 'Annual Pack – Special Offer', price: 5999, period: 'Year', description: 'Regular Price: ₹11,999 (50% OFF) • Full PMS Suite.' };
      case 'Yearly':
        return { name: 'Premium Property Pack', price: 17000, period: 'Year', description: 'Complete Hotel Management + OTA Connectivity.' };
    }
  };

  const planDetails = getPlanDetails(selectedPlan);
  const gstAmount = Math.round(planDetails.price * 0.18);
  const cgstAmount = Number((planDetails.price * 0.09).toFixed(2));
  const sgstAmount = Number((planDetails.price * 0.09).toFixed(2));
  const totalAmount = planDetails.price + gstAmount;

  const onboardTxNote = `DirectStay ${planDetails.name} - ${hotelName.trim() || 'New Hotel'}`;
  const onboardUpiLink = `upi://pay?pa=${encodeURIComponent(onboardUpiId)}&pn=${encodeURIComponent(
    onboardUpiPayee
  )}&am=${totalAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(onboardTxNote.slice(0, 60))}`;
  const onboardQrUrls = [
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&format=png&data=${encodeURIComponent(onboardUpiLink)}`,
    `https://quickchart.io/qr?size=220&margin=2&text=${encodeURIComponent(onboardUpiLink)}`,
  ];
  const onboardQrUrl = onboardQrUrls[Math.min(onboardQrIdx, onboardQrUrls.length - 1)];

  const handleCopyOnboardValue = (val: string, key: string, label: string) => {
    try {
      navigator.clipboard.writeText(val);
      setOnboardCopiedKey(key);
      showToast(`${label} copied`, 'success');
      setTimeout(() => setOnboardCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      showToast(`${label}: ${val}`, 'info');
    }
  };

  // Normalized phone & WhatsApp helpers
  const rawSupportDigits = String(systemWebsite.supportPhone || '7978563771').replace(/\D/g, '');
  const formattedSupportPhone = rawSupportDigits.startsWith('91') && rawSupportDigits.length === 12
    ? `+91 ${rawSupportDigits.slice(2, 7)} ${rawSupportDigits.slice(7)}`
    : rawSupportDigits.length === 10
    ? `+91 ${rawSupportDigits.slice(0, 5)} ${rawSupportDigits.slice(5)}`
    : systemWebsite.supportPhone
    ? `+${rawSupportDigits || systemWebsite.supportPhone}`
    : '+91 79785 63771';
  const supportDialDigits = rawSupportDigits.length === 10 ? `91${rawSupportDigits}` : (rawSupportDigits || '917978563771');
  const rawWhatsappInput = String(systemWebsite.whatsappNumber || systemWebsite.supportPhone || '7978563771').replace(/\D/g, '');
  const whatsappNumberDigits = rawWhatsappInput.length === 10 ? `91${rawWhatsappInput}` : (rawWhatsappInput || supportDialDigits);
  const telHref = `tel:+${supportDialDigits}`;
  const defaultWhatsappSalesMsg =
    'Hi, I am interested in trying DirectStay PMS for my hotel. Please share more details about the free trial and product demonstration.';
  const whatsappHref = `https://wa.me/${whatsappNumberDigits}?text=${encodeURIComponent(
    defaultWhatsappSalesMsg
  )}`;

  // Default hero trust indicators per Sales Conversion Requirements
  const heroTrustBadges =
    Array.isArray(systemWebsite.heroTrustBadges) && systemWebsite.heroTrustBadges.length > 0
      ? systemWebsite.heroTrustBadges
      : ['7-Day Free Trial', 'No Credit Card Required', 'Quick Hotel Setup'];
  const heroBottomPillars =
    Array.isArray(systemWebsite.heroBottomPillars) && systemWebsite.heroBottomPillars.length > 0
      ? systemWebsite.heroBottomPillars
      : INITIAL_SYSTEM_WEBSITE.heroBottomPillars || [];
  const featureCards =
    Array.isArray(systemWebsite.featureCards) && systemWebsite.featureCards.length > 0
      ? systemWebsite.featureCards
      : INITIAL_SYSTEM_WEBSITE.featureCards || [];
  const activeDynamicPackages = Array.isArray(packages)
    ? [...packages]
        .filter((p) => p && p.isActive !== false)
        .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
    : [];

  const dynamicPackagePricingCards = activeDynamicPackages.map((pkg, i) => {
    const base = Number(pkg.priceYearly || pkg.priceMonthly || 0);
    const gst = Number(pkg.gstRate ?? 18);
    const total = base + Math.round(base * (gst / 100));
    return {
      id: pkg.id || `dyn-pkg-${i}`,
      planKey: (pkg.billingCycle === 'Monthly' ? 'Monthly' : 'Yearly') as 'Trial' | 'Monthly' | 'HalfYearly' | 'Yearly',
      title: pkg.name,
      description: pkg.tagline || pkg.description || pkg.roomTierLabel || 'DirectStay Hospitality Plan',
      priceText: `₹${base.toLocaleString('en-IN')}`,
      periodText: pkg.billingCycle === 'Monthly' ? '/ Month' : '/ Year',
      gstText: `+ ${gst}% GST (Total ₹${total.toLocaleString('en-IN')})`,
      features:
        Array.isArray(pkg.features) && pkg.features.length > 0
          ? pkg.features
          : [
              pkg.roomTierLabel || (pkg.maxRooms >= 999 ? 'Unlimited Rooms' : `Up to ${pkg.maxRooms} Rooms`),
              pkg.otaLimitLabel || (pkg.modules?.ota ? 'OTA Channel Manager Sync' : 'Full PMS Operations'),
              'GST Billing, POS & Daily Collection Reports',
            ],
      buttonText: pkg.buttonText || `Choose ${pkg.name}`,
      badgeText: pkg.badge || pkg.discountLabel,
      isHighlighted: Boolean(pkg.isPopular),
      isPopular: Boolean(pkg.isPopular),
    };
  });

  const pricingCards =
    systemWebsite.useDynamicPackagesOnPricing && dynamicPackagePricingCards.length > 0
      ? dynamicPackagePricingCards
      : Array.isArray(systemWebsite.pricingCards) && systemWebsite.pricingCards.length > 0
      ? systemWebsite.pricingCards
      : dynamicPackagePricingCards.length > 0
      ? dynamicPackagePricingCards
      : INITIAL_SYSTEM_WEBSITE.pricingCards || [];
  const visionPillars =
    Array.isArray(systemWebsite.visionPillars) && systemWebsite.visionPillars.length > 0
      ? systemWebsite.visionPillars
      : INITIAL_SYSTEM_WEBSITE.visionPillars || [];
  const customSections = Array.isArray(systemWebsite.customSections)
    ? systemWebsite.customSections
    : [];

  // Handle Logo mock upload
  const handleLogoFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setLogoBase64(reader.result);
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
      handleLogoFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleLogoFile(e.target.files[0]);
    }
  };

  // Generate rooms matching chosen tier
  const generateTierRooms = (hotelId: string, tier: typeof roomTier): Room[] => {
    let count = 8;
    if (tier === '10-20') count = 15;
    if (tier === '20-30') count = 25;
    if (tier === '30-50') count = 40;

    const rooms: Room[] = [];
    
    for (let i = 1; i <= count; i++) {
      // Calculate floor numbers
      const floor = Math.floor((i - 1) / 10) + 1;
      const roomNumInFloor = ((i - 1) % 10) + 1;
      const rNum = `${floor}0${roomNumInFloor}`;
      
      // Distribute categories
      let cat = 'Standard';
      let rate = 1800;
      let extra = 400;
      let baseOcc = 2;
      let maxOcc = 3;

      if (i > count * 0.8) {
        cat = 'Presidential Suite';
        rate = 12000;
        extra = 1500;
        baseOcc = 2;
        maxOcc = 6;
      } else if (i > count * 0.5) {
        cat = 'Executive Suite';
        rate = 6500;
        extra = 1000;
        baseOcc = 2;
        maxOcc = 4;
      } else if (i > count * 0.25) {
        cat = 'Deluxe';
        rate = 3500;
        extra = 600;
        baseOcc = 2;
        maxOcc = 4;
      }

      rooms.push({
        id: `${hotelId}-${rNum}`,
        hotelId,
        number: rNum,
        category: cat,
        rate,
        status: 'Available',
        cleaningStatus: 'Clean',
        baseOccupancy: baseOcc,
        maxOccupancy: maxOcc,
        extraPersonCharge: extra
      });
    }
    return rooms;
  };

  const handleStartOnboard = (plan: typeof selectedPlan) => {
    setSelectedPlan(plan);
    setIsSubmittingOnboard(false);
    setShowWizard(true);
    setCurrentStep('branding');
    if (plan === 'Trial') {
      trackSeoConversionEvent('trial_cta_click', {
        plan: 'Trial',
        pagePath: typeof window !== 'undefined' ? window.location.pathname : '/'
      });
    } else {
      trackSeoConversionEvent('checkout_start', {
        plan,
        value: getPlanDetails(plan).price,
        pagePath: typeof window !== 'undefined' ? window.location.pathname : '/'
      });
    }
  };

  const handleOnboardSubmit = () => {
    if (!hotelName.trim() || isSubmittingOnboard || currentStep === 'processing') return;

    if (selectedPlan !== 'Trial') {
      const cleanUtr = onboardUtrRef.trim();
      if (!cleanUtr || cleanUtr.length < 6) {
        setOnboardUpiError('Please pay via UPI and enter your valid 12-digit UTR / Transaction Reference Number (minimum 6 characters).');
        showToast('Enter UPI UTR / Transaction Reference Number to proceed', 'warning');
        return;
      }
      setOnboardUpiError('');
    }
    
    setIsSubmittingOnboard(true);
    setCurrentStep('processing');
    setOnboardStatusIndex(0);

    // Steps sequence effect
    const interval = setInterval(() => {
      setOnboardStatusIndex(prev => {
        if (prev >= onboardStatuses.length - 1) {
          clearInterval(interval);
          completeCreation();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const completeCreation = async () => {
    const hotelId = `hotel-${Date.now()}`;
    const defaultLogo = 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=150&auto=format&fit=crop&q=60';
    
    const trialStartStr = new Date().toISOString().split('T')[0];
    const subscriptionEndStr = calculateEndDate(selectedPlan);
    const fullAddress = [hotelAddress.trim(), hotelCity.trim(), hotelCountry.trim()].filter(Boolean).join(', ') || 'India';

    // Create new hotel record
    const newHotel: HotelType = {
      id: hotelId,
      name: hotelName.trim(),
      address: fullAddress,
      phoneNumber: hotelPhone.trim() || '+91 94370 11223',
      emailAddress: hotelEmail.trim() || `contact@${hotelName.toLowerCase().replace(/\s+/g, '')}.com`,
      gstNumber: hotelGst.trim() || '',
      website: hotelWebsite.trim() || `www.${hotelName.toLowerCase().replace(/\s+/g, '')}.com`,
      logoUrl: logoBase64 || defaultLogo,
      subscriptionPlan: selectedPlan,
      subscriptionStatus: 'Pending',
      subscriptionPrice: planDetails.price,
      trialStartDate: trialStartStr,
      subscriptionEndDate: subscriptionEndStr,
      roomTierLimit: roomTier,
      ownerName: ownerFullName.trim() || 'Property Owner',
      panNumber: 'ABCDE1234F',
      checkInTime: '12:00',
      checkOutTime: '11:00',
      currency: 'INR',
      timeZone: 'Asia/Kolkata',
      whatsappNumber: hotelPhone.trim() || '+91 94370 11223',
      invoicePrefix: 'INV-',
      username: regUsername.trim() || 'admin',
      password: sha256(regPassword),
      ownerUsername: `${(regUsername.trim() || 'admin')}_owner`,
      ownerPassword: sha256(regPassword),
      emailSettings: { host: 'smtp.gmail.com', port: 587, user: `notifications@${hotelName.toLowerCase().replace(/\s+/g, '')}.com`, pass: 'securepass', secure: false },
      status: 'Pending',
      ...(selectedPlan !== 'Trial'
        ? {
            renewalRequest: {
              id: `ONB-PAY-${Date.now()}`,
              hotelId,
              hotelName: hotelName.trim(),
              requestedPackageId: `plan-${selectedPlan.toLowerCase()}`,
              requestedPackageName: planDetails.name,
              requestedPlan: selectedPlan,
              requestedAmount: totalAmount,
              baseAmount: planDetails.price,
              gstRate: 18,
              gstAmount,
              cgstAmount,
              sgstAmount,
              totalAmount,
              paymentMethod: 'UPI',
              upiIdUsed: onboardUpiId,
              transactionReference: onboardUtrRef.trim(),
              notes: onboardPayerUpi.trim() ? `Onboarding UPI Payment • Payer: ${onboardPayerUpi.trim()}` : 'Onboarding UPI Payment',
              status: 'Pending' as const,
              paymentVerificationStatus: 'Pending Verification' as const,
              requestedAt: new Date().toISOString(),
              requestedBy: ownerFullName.trim() || regUsername.trim() || 'Hotel Owner',
            },
          }
        : {}),
    };

    // Start new hotel with zero static rooms (admin adds rooms manually)
    const roomsList: Room[] = [];

    try {
      sessionStorage.setItem(
        'pms_pending_approval_auth',
        JSON.stringify({
          hotel: newHotel,
          username: regUsername.trim() || 'admin',
          password: regPassword,
          blockType: 'Pending',
        })
      );
    } catch {}

    // Pass to parent handler and verify backend creation
    const result = await onOnboardComplete(newHotel, roomsList);
    if (result && result.success === false) {
      try {
        sessionStorage.removeItem('pms_pending_approval_auth');
      } catch {}
      setIsSubmittingOnboard(false);
      setCurrentStep('branding');
      return;
    }

    // Record Lead in Salesperson CRM (pms_sales_leads) & fire verified conversion event
    try {
      const leadSource = detectLeadSource();
      const existingLeads = JSON.parse(localStorage.getItem('pms_sales_leads') || '[]');
      const nextFollowUp = new Date();
      nextFollowUp.setDate(nextFollowUp.getDate() + 1);
      const newLead = {
        id: `LEAD-${Date.now()}`,
        hotelId,
        name: ownerFullName.trim() || regUsername.trim(),
        hotelName: hotelName.trim(),
        email: newHotel.emailAddress,
        phone: newHotel.phoneNumber,
        city: hotelCity.trim() || 'India',
        country: hotelCountry.trim() || 'India',
        roomsCount: roomTier,
        registrationDate: trialStartStr,
        trialStartDate: trialStartStr,
        trialExpiryDate: subscriptionEndStr,
        lastActivityDate: new Date().toISOString(),
        demoBookingDateTime: '',
        subscriptionStatus: selectedPlan === 'Trial' ? 'New Trial' : 'Paid Customer',
        selectedPlan,
        leadSource,
        salespersonNotes: `Registered via self-service onboarding (${selectedPlan}). Room Tier: ${roomTier}.`,
        nextFollowUpDate: nextFollowUp.toISOString().split('T')[0],
        followUpHistory: [
          {
            date: new Date().toISOString(),
            stage: 'Immediate',
            channel: 'Email & System',
            summary: `Welcome email & login credentials (${newHotel.username}) dispatched. 7-day trial started (${trialStartStr} to ${subscriptionEndStr}).`
          }
        ]
      };
      localStorage.setItem('pms_sales_leads', JSON.stringify([newLead, ...existingLeads]));

      if (selectedPlan === 'Trial') {
        trackSeoConversionEvent('trial_registration', {
          plan: 'Trial',
          roomTier,
          value: 0,
          dedupeKey: hotelId,
          leadSource
        });
      } else {
        trackSeoConversionEvent('subscription_purchase', {
          plan: selectedPlan,
          roomTier,
          value: totalAmount,
          dedupeKey: hotelId,
          leadSource
        });
      }
    } catch {
      // non-blocking CRM sync
    }
  };

  const calculateEndDate = (plan: typeof selectedPlan) => {
    const d = new Date();
    if (plan === 'Trial') d.setDate(d.getDate() + 7);
    else if (plan === 'Monthly') d.setDate(d.getDate() + 30);
    else if (plan === 'HalfYearly') d.setDate(d.getDate() + 365);
    else if (plan === 'Yearly') d.setDate(d.getDate() + 365);
    return d.toISOString().split('T')[0];
  };

  const currentSeoMeta = PUBLIC_SEO_PAGES[activeSeoPage] || PUBLIC_SEO_PAGES.home;

  // Available 15-Minute Demo Slots (with double-booking prevention against pms_sales_leads)
  const DEMO_TIME_SLOTS = [
    '10:30 AM - 10:45 AM IST',
    '11:00 AM - 11:15 AM IST',
    '12:00 PM - 12:15 PM IST',
    '02:30 PM - 02:45 PM IST',
    '04:00 PM - 04:15 PM IST',
    '05:30 PM - 05:45 PM IST',
    '07:00 PM - 07:15 PM IST'
  ];

  const isDemoSlotBooked = (dateStr: string, slotStr: string) => {
    if (typeof window === 'undefined') return false;
    try {
      const leads = JSON.parse(localStorage.getItem('pms_sales_leads') || '[]');
      const target = `${dateStr} | ${slotStr}`;
      return Array.isArray(leads) && leads.some((l: any) => l.demoBookingDateTime === target && l.subscriptionStatus !== 'Not Interested');
    } catch {
      return false;
    }
  };

  const handleBookDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoName.trim() || !demoHotelName.trim() || !demoPhone.trim() || !demoEmail.trim() || !demoCity.trim()) {
      showToast('Please fill in Name, Hotel Name, Email, Phone Number, and City to schedule your 15-minute demo.', 'warning');
      return;
    }
    if (isDemoSlotBooked(demoDate, demoPreferredTime)) {
      showToast('This appointment slot was just reserved. Please select another available 15-minute slot.', 'error');
      return;
    }
    const bookingId = `DEMO-${Date.now()}`;
    const bookingDateTime = `${demoDate} | ${demoPreferredTime}`;
    try {
      const existingLeads = JSON.parse(localStorage.getItem('pms_sales_leads') || '[]');
      const newDemoLead = {
        id: bookingId,
        hotelId: '',
        name: demoName.trim(),
        hotelName: demoHotelName.trim(),
        email: demoEmail.trim(),
        phone: demoPhone.trim(),
        city: demoCity.trim(),
        country: 'India',
        roomsCount: demoRoomsCount,
        registrationDate: new Date().toISOString().split('T')[0],
        trialStartDate: '',
        trialExpiryDate: '',
        lastActivityDate: new Date().toISOString(),
        demoBookingDateTime: bookingDateTime,
        subscriptionStatus: 'Demo Booked',
        selectedPlan: 'Trial',
        leadSource: 'Calendly',
        salespersonNotes: `DirectStay PMS — Free 15-Minute Demo scheduled for ${bookingDateTime}. Approx rooms: ${demoRoomsCount}.`,
        nextFollowUpDate: demoDate,
        followUpHistory: [
          {
            date: new Date().toISOString(),
            stage: 'Demo Scheduled',
            channel: 'Calendly / Email',
            summary: `Booked DirectStay PMS — Free 15-Minute Demo on ${bookingDateTime}. Confirmation & calendar invite sent.`
          }
        ]
      };
      localStorage.setItem('pms_sales_leads', JSON.stringify([newDemoLead, ...existingLeads]));
    } catch {
      // ignore storage errors
    }

    trackSeoConversionEvent('demo_booking', {
      roomTier: demoRoomsCount,
      dedupeKey: bookingId,
      leadSource: 'Calendly',
      pagePath: typeof window !== 'undefined' ? window.location.pathname : '/'
    });

    setConfirmedDemoBooking({
      id: bookingId,
      name: demoName.trim(),
      hotelName: demoHotelName.trim(),
      email: demoEmail.trim(),
      phone: demoPhone.trim(),
      city: demoCity.trim(),
      rooms: demoRoomsCount,
      date: demoDate,
      slot: demoPreferredTime
    });

    showToast(
      `DirectStay PMS — Free 15-Minute Demo booked for ${demoDate} (${demoPreferredTime})!`,
      'success',
      'Demo Appointment Confirmed',
      8000
    );
  };

  const handleCancelDemoBooking = (bookingId: string) => {
    try {
      const existingLeads = JSON.parse(localStorage.getItem('pms_sales_leads') || '[]');
      const updated = existingLeads.map((l: any) =>
        l.id === bookingId
          ? { ...l, demoBookingDateTime: '', subscriptionStatus: 'Follow-Up Required', salespersonNotes: `${l.salespersonNotes} (Rescheduled/Cancelled by user)` }
          : l
      );
      localStorage.setItem('pms_sales_leads', JSON.stringify(updated));
    } catch {
      // ignore
    }
    setConfirmedDemoBooking(null);
    showToast('Your demo slot has been released. You may select a new date and time anytime.', 'info');
  };

  const handleContactFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) {
      showToast('Please enter your Name and Contact Phone.', 'warning');
      return;
    }
    trackSeoConversionEvent('contact_form_submission', {
      pagePath: typeof window !== 'undefined' ? window.location.pathname : '/contact/'
    });
    setContactSubmitted(true);
    showToast(
      `Thank you, ${contactName.trim()}! Your enquiry has been received by the DirectStay team.`,
      'success',
      'Enquiry Submitted'
    );
    setContactName('');
    setContactHotel('');
    setContactPhone('');
    setContactMessage('');
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden overflow-x-clip bg-[#0E0906] text-[#e2d5c5] selection:bg-luxury-gold-300 selection:text-luxury-brown-950">
      {/* HEADER NAVBAR (Fixed at Top Across All Sections — Extreme Left Logo, Center Nav, Extreme Right Sign In) */}
      <header className="fixed top-0 left-0 right-0 w-full max-w-[100vw] z-50 bg-[#120A06]/90 backdrop-blur-md border-b border-[#C5A059]/20 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
        <div className="w-full px-3 sm:px-4 lg:px-6 h-16 relative flex items-center justify-between gap-2">
          {/* EXTREME LEFT: Brand Identity */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateSeo('home');
            }}
            className="shrink-0 flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DFBD78] rounded-xl text-left cursor-pointer"
          >
            {systemWebsite.logoUrl ? (
              <img
                src={systemWebsite.logoUrl}
                alt="DirectStay Hotel Management Software Logo"
                className="w-8 h-8 sm:w-10 sm:h-10 object-cover rounded-xl border border-[#DFBD78]/40 shadow-md shrink-0"
              />
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-b from-[#E5C687] via-[#D4AF6A] to-[#B68D43] rounded-xl flex items-center justify-center text-[#140C07] shadow-md border border-[#F5DFA3]/40 shrink-0">
                <Hotel className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
            )}
            <div className="leading-tight min-w-0 overflow-hidden">
              <span className="text-[7.5px] sm:text-[9px] uppercase font-mono tracking-[0.06em] sm:tracking-[0.2em] text-[#C8A45D] font-semibold block truncate">
                {systemWebsite.brandTagline || 'Hotel PMS & Booking SaaS'}
              </span>
              <span className="text-[15px] sm:text-xl font-serif font-bold text-[#FAF6F0] tracking-tight block group-hover:text-[#E5C687] transition-colors truncate">
                {systemWebsite.businessName || 'DirectStay'}
              </span>
            </div>
          </a>

          {/* CENTER: SEO Navigation Links (Desktop) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center justify-center gap-7 text-[13.5px] font-medium text-[#EFE6DA] lg:absolute lg:left-1/2 lg:-translate-x-1/2"
          >
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigateSeo('home');
              }}
              className={`hover:text-[#E5C687] transition-colors whitespace-nowrap cursor-pointer ${
                activeSeoPage === 'home' ? 'text-[#E5C687] font-bold' : ''
              }`}
            >
              Home
            </a>
            <a
              href="/features/"
              onClick={(e) => {
                e.preventDefault();
                navigateSeo('features');
              }}
              className={`hover:text-[#E5C687] transition-colors whitespace-nowrap cursor-pointer ${
                activeSeoPage === 'features' ? 'text-[#E5C687] font-bold' : ''
              }`}
            >
              Features
            </a>
            <a
              href="/pricing/"
              onClick={(e) => {
                e.preventDefault();
                navigateSeo('pricing');
              }}
              className={`hover:text-[#E5C687] transition-colors whitespace-nowrap cursor-pointer ${
                activeSeoPage === 'pricing' ? 'text-[#E5C687] font-bold' : ''
              }`}
            >
              Pricing
            </a>
            <a
              href="/about/"
              onClick={(e) => {
                e.preventDefault();
                navigateSeo('about');
              }}
              className={`hover:text-[#E5C687] transition-colors whitespace-nowrap cursor-pointer ${
                activeSeoPage === 'about' ? 'text-[#E5C687] font-bold' : ''
              }`}
            >
              About
            </a>
            <a
              href="/contact/"
              onClick={(e) => {
                e.preventDefault();
                navigateSeo('contact');
              }}
              className={`hover:text-[#E5C687] transition-colors whitespace-nowrap cursor-pointer ${
                activeSeoPage === 'contact' ? 'text-[#E5C687] font-bold' : ''
              }`}
            >
              Contact
            </a>
            {(Array.isArray(systemWebsite.headerNavLinks) ? systemWebsite.headerNavLinks : [])
              .filter((item) => item && item.isVisible !== false && item.label && item.href)
              .slice(0, 4)
              .map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  target={item.isExternal ? '_blank' : undefined}
                  rel={item.isExternal ? 'noopener noreferrer' : undefined}
                  onClick={(e) => {
                    if (!item.isExternal && item.href.startsWith('/page/')) {
                      e.preventDefault();
                      const slug = item.href.replace(/^\/page\//, '').replace(/\/+$/, '');
                      const found = publishedCustomPages.find((p) => p.slug === slug);
                      if (found) setActiveCustomPage(found);
                    }
                  }}
                  className="hover:text-[#E5C687] transition-colors whitespace-nowrap cursor-pointer"
                >
                  {item.label}
                </a>
              ))}
            {publishedCustomPages
              .filter((p) => p.showInHeader)
              .slice(0, 3)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveCustomPage(p)}
                  className="hover:text-[#E5C687] transition-colors whitespace-nowrap cursor-pointer"
                >
                  {p.title}
                </button>
              ))}
          </nav>

          {/* EXTREME RIGHT: Sign In Button ONLY */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="inline-flex items-center gap-1.5 sm:gap-2 text-[11.5px] sm:text-[13px] font-semibold text-[#F5EFE6] hover:text-[#140C07] bg-[#1A120C]/90 hover:bg-gradient-to-r hover:from-[#E5C687] hover:to-[#C89D52] border border-[#C5A059]/55 hover:border-[#FAF6F0]/60 px-3.5 sm:px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DFBD78]"
            >
              <LogIn className="w-3.5 h-3.5 text-[#D4AF6A] shrink-0" />
              <span className="whitespace-nowrap">Sign In</span>
            </button>
          </div>
        </div>

        {/* Responsive Mobile / Tablet Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#120B07]/98 border-b border-[#C5A059]/25 px-4 pt-3 pb-4 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm font-medium text-[#E8DFD1]">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateSeo('home');
                }}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#1E140D] hover:text-[#E5C687] transition-colors cursor-pointer"
              >
                Home
              </a>
              <a
                href="/features/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateSeo('features');
                }}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#1E140D] hover:text-[#E5C687] transition-colors cursor-pointer"
              >
                Features
              </a>
              <a
                href="/hotel-reservation-software/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateSeo('hotel-reservation-software');
                }}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#1E140D] hover:text-[#E5C687] transition-colors cursor-pointer"
              >
                Hotel Reservation Software
              </a>
              <a
                href="/hotel-billing-software/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateSeo('hotel-billing-software');
                }}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#1E140D] hover:text-[#E5C687] transition-colors cursor-pointer"
              >
                Hotel Billing Software
              </a>
              <a
                href="/pricing/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateSeo('pricing');
                }}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#1E140D] hover:text-[#E5C687] transition-colors cursor-pointer"
              >
                Pricing Plans
              </a>
              <a
                href="/free-trial/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateSeo('free-trial');
                }}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#1E140D] hover:text-[#E5C687] transition-colors cursor-pointer"
              >
                7-Day Free Trial
              </a>
              <a
                href="/about/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateSeo('about');
                }}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#1E140D] hover:text-[#E5C687] transition-colors cursor-pointer"
              >
                About Us
              </a>
              <a
                href="/contact/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateSeo('contact');
                }}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#1E140D] hover:text-[#E5C687] transition-colors cursor-pointer"
              >
                Contact
              </a>
            </div>
            <div className="pt-2 border-t border-[#C5A059]/15 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleStartOnboard('Trial');
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 text-xs font-bold bg-gradient-to-r from-[#E2C280] via-[#D2AC64] to-[#B88E44] text-[#140C07] px-4 py-2.5 rounded-lg shadow-md cursor-pointer"
              >
                <span>Start 7-Day Free Trial</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowDemoModal(true);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 text-xs font-bold bg-[#241911] border border-[#C5A059]/40 text-[#FAF6F0] px-4 py-2.5 rounded-lg cursor-pointer"
              >
                <span>Book a Free Demo</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* DEDICATED INNER SEO PAGE HERO + BREADCRUMBS (When visiting /features/, /pricing/, /free-trial/, /hotel-reservation-software/, /hotel-billing-software/, /about/, /contact/) */}
      {activeSeoPage !== 'home' && (
        <section className="pt-24 pb-12 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#17100B] via-[#120C08] to-[#0E0906] border-b border-[#C5A059]/25">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-[#C8B9A6]">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateSeo('home');
                }}
                className="hover:text-[#E5C687] transition-colors"
              >
                Home
              </a>
              <span>/</span>
              <span className="text-[#E5C687] font-semibold" aria-current="page">
                {currentSeoMeta.breadcrumbLabel}
              </span>
            </nav>

            <div className="w-full min-w-0 max-w-3xl space-y-4">
              <div className="inline-flex items-center max-w-full px-3 py-1 rounded-2xl sm:rounded-full bg-[#241911] border border-[#C5A059]/40 text-[#E5C687] text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.08em] sm:tracking-[0.18em] font-semibold whitespace-normal break-words">
                {currentSeoMeta.primaryKeyword} • DirectStay PMS
              </div>

              {/* Exactly ONE Primary H1 per page */}
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#FAF6F0] tracking-tight leading-[1.15] break-words">
                {currentSeoMeta.h1}
              </h1>

              <p className="text-sm sm:text-base text-[#DED2C2] leading-relaxed break-words">
                {currentSeoMeta.description}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleStartOnboard('Trial')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#E2C280] via-[#D2AC64] to-[#B88E44] hover:from-[#EAD092] hover:to-[#C69C52] text-[#140C07] font-serif font-bold text-xs sm:text-sm px-5 sm:px-6 py-3 rounded-xl shadow-lg cursor-pointer"
                >
                  <span>Start 7-Day Free Trial</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDemoModal(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1D140E] hover:bg-[#281C14] border border-[#C5A059]/50 text-[#FAF6F0] font-serif font-bold text-xs sm:text-sm px-5 sm:px-6 py-3 rounded-xl cursor-pointer"
                >
                  <span>Book a Free Demo</span>
                </button>
              </div>
            </div>

            {/* Specialized Product Module Breakdown for /hotel-reservation-software/, /hotel-billing-software/, /free-trial/, /about/ */}
            {activeSeoPage === 'hotel-reservation-software' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6 border-t border-[#C5A059]/15">
                <div className="rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                  <h2 className="text-base font-serif font-bold text-[#E5C687]">
                    Real-Time Room Availability Calendar
                  </h2>
                  <p className="text-xs text-[#D5C7B4] leading-relaxed">
                    View date-wise room occupancy across Standard, Deluxe, Executive, and Suite categories. Prevent double bookings and assign rooms instantaneously.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                  <h2 className="text-base font-serif font-bold text-[#E5C687]">
                    Advance Bookings &amp; Walk-In Check-Ins
                  </h2>
                  <p className="text-xs text-[#D5C7B4] leading-relaxed">
                    Record advance reservation deposits, capture Aadhaar/Passport ID proofs (GRC), manage companion guests, and convert reservations to active stays in one click.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                  <h2 className="text-base font-serif font-bold text-[#E5C687]">
                    Flexible Occupancy &amp; Extra Guest Rules
                  </h2>
                  <p className="text-xs text-[#D5C7B4] leading-relaxed">
                    Configure Base Occupancy, Max Occupancy, Extra Person Charges, and Optional Hotel Services per room so tariffs calculate accurately every time.
                  </p>
                </div>
              </div>
            )}

            {activeSeoPage === 'hotel-billing-software' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6 border-t border-[#C5A059]/15">
                <div className="rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                  <h2 className="text-base font-serif font-bold text-[#E5C687]">
                    GST-Compliant Hotel Tax Invoicing
                  </h2>
                  <p className="text-xs text-[#D5C7B4] leading-relaxed">
                    Generate accurate CGST &amp; SGST hotel bills with B2B customer GSTIN support, customizable invoice conditions, and instant A4 print or PDF download.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                  <h2 className="text-base font-serif font-bold text-[#E5C687]">
                    Unified Guest Stay Folio &amp; POS Sync
                  </h2>
                  <p className="text-xs text-[#D5C7B4] leading-relaxed">
                    Automatically consolidate room rent, extra bed, extra person charges, restaurant POS food orders, laundry, and water/room services onto a single check-out bill.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                  <h2 className="text-base font-serif font-bold text-[#E5C687]">
                    Advance Deposits, Split Settlements &amp; Ledgers
                  </h2>
                  <p className="text-xs text-[#D5C7B4] leading-relaxed">
                    Track advance collections, apply check-out discounts or bill adjustments, settle via Cash, UPI, Card, or Bank Transfer, and sync directly with daily cash handovers.
                  </p>
                </div>
              </div>
            )}

            {activeSeoPage === 'free-trial' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6 border-t border-[#C5A059]/15">
                <div className="rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                  <h2 className="text-base font-serif font-bold text-[#E5C687]">
                    1. Register Your Property in 2 Minutes
                  </h2>
                  <p className="text-xs text-[#D5C7B4] leading-relaxed">
                    Click &ldquo;Start 7-Day Free Trial&rdquo;, enter your hotel name, contact phone, and desired admin username. No credit card or upfront payment is required.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                  <h2 className="text-base font-serif font-bold text-[#E5C687]">
                    2. Explore All Hotel PMS Modules Free
                  </h2>
                  <p className="text-xs text-[#D5C7B4] leading-relaxed">
                    Test reservations, walk-in check-ins, room management, housekeeping, POS billing, GST invoices, and financial reports with your own team for 7 full days.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                  <h2 className="text-base font-serif font-bold text-[#E5C687]">
                    3. Choose a Plan Only When Ready
                  </h2>
                  <p className="text-xs text-[#D5C7B4] leading-relaxed">
                    Upgrade seamlessly to our Monthly Pack (₹1,899/month), Annual Pack – Special Offer (₹5,999/year, 50% OFF), or Premium Property Pack (₹17,000/year) while keeping all your configured rooms and data intact.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* FIRST SCREEN (HOMEPAGE HERO): NAVBAR + CINEMATIC RESORT HERO + 4-PILLAR BAR IN 1 VIEWPORT */}
      {activeSeoPage === 'home' && (
        <div className="relative w-full lg:h-screen lg:min-h-[600px] lg:max-h-[960px] pt-16 flex flex-col justify-between overflow-hidden border-b border-[#C5A059]/20">
          {/* Background Resort Pool Image at Sunset (/hero-resort.jpg) */}
          <div className="absolute inset-0 z-0">
            <img
              src={systemWebsite.heroBgImageUrl || '/hero-resort.jpg'}
              alt="DirectStay Smart Hotel Management Software and Cloud Property Management System Dashboard"
              className="w-full h-full object-cover object-center lg:object-[65%_center]"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(90deg, rgba(12,7,4,0.92) 0%, rgba(16,10,6,0.84) 32%, rgba(18,11,7,0.48) 52%, rgba(14,9,5,0.10) 74%, rgba(12,8,5,0.22) 100%)'
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, rgba(12,7,4,0.82) 0%, rgba(12,7,4,0.20) 16%, rgba(12,7,4,0.05) 68%, rgba(12,7,4,0.78) 88%, rgba(10,6,4,0.94) 100%)'
              }}
            />
          </div>

          {/* HERO MAIN CONTENT */}
          <section className="relative z-10 flex-1 flex items-center w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-2 overflow-hidden">
            <div className="w-full min-w-0 max-w-full sm:max-w-[720px] space-y-3.5 lg:space-y-4 text-left">
              {/* Eyebrow Pill */}
              <div className="inline-flex items-center max-w-full px-3 sm:px-3.5 py-1 rounded-2xl sm:rounded-full bg-[#19110B]/80 border border-[#C5A059]/45 text-[#E5C687] text-[9px] sm:text-[10px] font-mono tracking-[0.07em] sm:tracking-[0.18em] uppercase font-semibold shadow-sm backdrop-blur-xs whitespace-normal break-words">
                <span>Cloud-Based Hotel PMS Software • DirectStay</span>
              </div>

              {/* Exact Primary H1 Heading per Website Conversion Requirement */}
              <h1 className="font-serif font-bold text-[#FAF6F0] tracking-[-0.015em] leading-[1.14] text-[24px] sm:text-[36px] lg:text-[42px] xl:text-[46px] break-words">
                Hotel Management Software to{' '}
                <span className="bg-gradient-to-r from-[#F2D69B] via-[#DFBD78] to-[#C89D52] bg-clip-text text-transparent">
                  Simplify Your Hotel Operations
                </span>
              </h1>

              {/* Supporting text */}
              <p className="text-[#EAE0D2]/95 text-xs sm:text-[13.5px] lg:text-[15px] leading-[1.6] w-full max-w-full sm:max-w-[580px] font-normal break-words">
                Manage reservations, front-desk operations, housekeeping, guest records, billing and hotel reporting from one platform with DirectStay PMS.
              </p>

              {/* Primary CTA (Start Your 7-Day Free Trial) & Secondary CTA (Book a Free Demo) */}
              <div className="w-full max-w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleStartOnboard('Trial')}
                  className="w-full sm:w-auto max-w-full inline-flex items-center justify-center gap-2 sm:gap-2.5 bg-gradient-to-r from-[#E2C280] via-[#D2AC64] to-[#B88E44] hover:from-[#EAD092] hover:to-[#C69C52] text-[#140C07] font-serif font-bold text-[13px] sm:text-[13.5px] lg:text-[14.5px] px-4 sm:px-6 py-3 rounded-xl shadow-[0_10px_28px_rgba(0,0,0,0.45)] border border-[#F5DFA3]/40 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DFBD78]"
                >
                  <span>Start Your 7-Day Free Trial</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.2] shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedDemoBooking(null);
                    setShowDemoModal(true);
                  }}
                  className="w-full sm:w-auto max-w-full inline-flex items-center justify-center gap-2 sm:gap-2.5 bg-[#150E09]/80 hover:bg-[#22170F]/95 border border-[#C5A059]/50 hover:border-[#DFBD78]/85 text-[#FAF6F0] font-serif font-bold text-[13px] sm:text-[13.5px] lg:text-[14.5px] px-4 sm:px-6 py-3 rounded-xl backdrop-blur-md shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DFBD78]"
                >
                  <Calendar className="w-4 h-4 text-[#DFBD78] shrink-0" />
                  <span>Book a Free Demo</span>
                </button>
              </div>

              {/* Compact Trust Indicators */}
              <div className="w-full max-w-full flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-1.5 pt-1 text-[11px] sm:text-xs text-[#DFD3C3]/95 font-medium">
                {heroTrustBadges.map((badge, idx) => (
                  <div key={idx} className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full border border-[#C5A059]/70 bg-[#C5A059]/15 flex items-center justify-center text-[#DFBD78] shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[2.6]" />
                    </span>
                    <span>{badge}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 4-COLUMN BOTTOM FEATURE STRIP */}
          <div className="relative z-10 shrink-0 bg-gradient-to-t from-[#0A0604]/95 via-[#0E0906]/75 to-transparent pt-2 pb-4 lg:py-4">
            <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#C5A059]/25">
                {heroBottomPillars.map((pillar, idx) => (
                  <div key={pillar.id || idx} className="px-3 lg:px-5 py-2.5 sm:py-1 flex flex-col items-center text-center group">
                    <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-[#1A120B]/85 border border-[#C5A059]/45 group-hover:border-[#DFBD78]/80 flex items-center justify-center text-[#DFBD78] mb-2 shadow-sm transition-colors">
                      {idx % 4 === 0 && (
                        <svg className="w-4 h-4 lg:w-5 lg:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 7v11m0-4h18m0 4V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2" />
                          <path d="M7 10h4a1 1 0 0 1 1 1v3H6v-3a1 1 0 0 1 1-1Z" />
                          <path d="M13 10h4a1 1 0 0 1 1 1v3h-6v-3a1 1 0 0 1 1-1Z" />
                        </svg>
                      )}
                      {idx % 4 === 1 && (
                        <svg className="w-4 h-4 lg:w-5 lg:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m19 5-7 7" />
                          <path d="m12 12-5.5 1.5L5 19l5.5-1.5L12 12Z" />
                          <path d="m8.5 13.5 2 2" />
                          <path d="M16 17h.01" />
                          <path d="M19 14v2" />
                          <path d="M18 15h2" />
                        </svg>
                      )}
                      {idx % 4 === 2 && (
                        <svg className="w-4 h-4 lg:w-5 lg:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="9" r="3" />
                          <path d="M6.5 19a5.5 5.5 0 0 1 11 0" />
                        </svg>
                      )}
                      {idx % 4 === 3 && <BarChart3 className="w-4 h-4 lg:w-5 lg:h-5" />}
                    </div>
                    <h3 className="font-serif font-bold text-sm lg:text-[15px] text-[#FAF6F0] tracking-tight">
                      {pillar.title}
                    </h3>
                    <p className="text-[11px] text-[#C8B9A6] leading-snug mt-0.5 max-w-[230px]">
                      {pillar.subtitle}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CORE FEATURES — H2: Everything You Need to Manage Your Hotel */}
      <section
        id="features"
        className="relative py-12 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-10 border-b border-[#C5A059]/15 bg-gradient-to-b from-[#0E0906] via-[#140D08] to-[#0E0906] overflow-hidden"
      >
        <div className="relative z-10 w-full max-w-[1440px] mx-auto space-y-10 lg:space-y-12">
          {/* Section Header */}
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF6A] font-bold block">
              All-In-One Cloud Hotel PMS Software
            </span>
            <h2 className="font-serif font-bold text-[#FAF6F0] tracking-tight leading-[1.15] text-2xl sm:text-3xl lg:text-4xl">
              Everything You Need to Manage Your Hotel
            </h2>
            <p className="text-[#D8CBB8]/85 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-normal">
              DirectStay PMS brings hotel reservations, front desk check-ins, room management, housekeeping, POS billing, and owner reports together in one fast, reliable platform.
            </p>
          </div>

          {/* Features Cards Grid (H3 hierarchy under H2) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
            {featureCards.map((card, idx) => (
              <div
                key={card.id || idx}
                className="group relative h-full flex flex-col justify-between bg-gradient-to-b from-[#1B130C]/95 to-[#120C07]/95 border border-[#C5A059]/25 hover:border-[#DFBD78]/60 rounded-2xl p-6 sm:p-7 shadow-[0_12px_32px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-[#231810] border border-[#C5A059]/40 group-hover:border-[#DFBD78]/75 flex items-center justify-center text-[#DFBD78] shadow-inner transition-colors shrink-0">
                    {idx % 4 === 0 && <RefreshCw className="w-5 h-5 stroke-[1.85]" />}
                    {idx % 4 === 1 && <Users className="w-5 h-5 stroke-[1.85]" />}
                    {idx % 4 === 2 && <BarChart3 className="w-5 h-5 stroke-[1.85]" />}
                    {idx % 4 === 3 && <ShieldCheck className="w-5 h-5 stroke-[1.85]" />}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg sm:text-xl font-serif font-bold text-[#FAF6F0] tracking-tight group-hover:text-[#F2D69B] transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-[#D8CBB8]/80 text-xs sm:text-sm leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>

                {card.bullets && card.bullets.length > 0 && (
                  <div className="pt-4 mt-5 border-t border-[#C5A059]/15 space-y-2 text-xs text-[#C8B8A4] font-medium">
                    {card.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-[#C5A059]/15 border border-[#C5A059]/45 flex items-center justify-center text-[#DFBD78] shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                        </span>
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Feature Section Free-Trial & Product Module Internal Links Bar */}
          <div className="mt-8 pt-6 border-t border-[#C9A65B]/15 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#140D09]/80 border border-[#C9A65B]/20 rounded-2xl p-5">
            <div className="space-y-1 text-center sm:text-left">
              <p className="text-sm font-serif font-semibold text-[#FAF6F0]">
                Explore Dedicated Hotel PMS Modules or Start Your 7-Day Free Trial
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs font-mono text-[#D4AF6A]">
                <a
                  href="/hotel-reservation-software/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSeoRoute('hotel-reservation-software', 'reservations');
                  }}
                  className="hover:text-[#FAF6F0] underline underline-offset-4"
                >
                  Hotel Reservation Software
                </a>
                <span>•</span>
                <a
                  href="/hotel-billing-software/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSeoRoute('hotel-billing-software', 'billing');
                  }}
                  className="hover:text-[#FAF6F0] underline underline-offset-4"
                >
                  Hotel Billing Software
                </a>
                <span>•</span>
                <a
                  href="/pricing/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSeoRoute('pricing', 'pricing');
                  }}
                  className="hover:text-[#FAF6F0] underline underline-offset-4"
                >
                  Hotel PMS Pricing
                </a>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleStartOnboard('Trial')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-black text-xs tracking-wide shadow-md cursor-pointer"
              >
                <span>Start 7-Day Free Trial</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowDemoModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#241911] hover:bg-[#2F2016] text-[#EAE0D3] border border-[#C9A65B]/30 text-xs font-semibold cursor-pointer"
              >
                <span>Book a Free Demo</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* H2 SECTION 2: SIMPLIFY HOTEL RESERVATIONS AND ROOM MANAGEMENT */}
      <section
        id="reservations"
        className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-[#0B0705] border-t border-[#C9A65B]/15"
      >
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="max-w-3xl mx-auto text-center space-y-2.5">
            <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/30 px-3 py-1 rounded-full">
              Hotel Reservation &amp; Front Desk Software
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
              Simplify Hotel Reservations and Room Management
            </h2>
            <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed">
              Manage walk-in check-ins, advance bookings, multi-room group reservations, and live housekeeping status from a single cloud-based hotel reservation software dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <div className="rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#241911] border border-[#C9A65B]/35 flex items-center justify-center text-[#E5C687]">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-serif font-bold text-[#FAF6F0]">
                Centralized Booking &amp; Walk-In Desk
              </h3>
              <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                Create instant walk-in check-ins or advance room reservations with automated conflict detection, guest ID document capture, and customizable room rate overrides.
              </p>
            </div>

            <div className="rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#241911] border border-[#C9A65B]/35 flex items-center justify-center text-[#E5C687]">
                <BedDouble className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-serif font-bold text-[#FAF6F0]">
                Live Room Inventory &amp; Housekeeping
              </h3>
              <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                Track Available, Occupied, Reserved, Dirty, and Maintenance rooms in real time so front-desk receptionists and housekeeping teams stay synchronized.
              </p>
            </div>

            <div className="rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#241911] border border-[#C9A65B]/35 flex items-center justify-center text-[#E5C687]">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-serif font-bold text-[#FAF6F0]">
                Direct Booking Engine &amp; OTA Sync
              </h3>
              <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                Accept zero-commission direct website bookings alongside OTA reservation tracking to eliminate double-bookings and maximize room occupancy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* H2 SECTION 3: STREAMLINE HOTEL BILLING AND INVOICING */}
      <section
        id="billing"
        className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#0E0906] via-[#120C08] to-[#0E0906] border-t border-[#C9A65B]/15"
      >
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="max-w-3xl mx-auto text-center space-y-2.5">
            <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/30 px-3 py-1 rounded-full">
              Hotel Billing &amp; GST Invoicing Software
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
              Streamline Hotel Billing and Invoicing
            </h2>
            <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed">
              Generate accurate GST and non-GST guest invoices, link room service POS orders directly to room folios, and record split payments across Cash, UPI, Card, and Bank Transfer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <div className="rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#241911] border border-[#C9A65B]/35 flex items-center justify-center text-[#E5C687]">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-serif font-bold text-[#FAF6F0]">
                GST-Compliant Hotel Folios &amp; Invoices
              </h3>
              <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                Automatically calculate CGST, SGST, or IGST slabs, attach corporate B2B GSTIN details, and print or share clean A4 and thermal checkout invoices in one click.
              </p>
            </div>

            <div className="rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#241911] border border-[#C9A65B]/35 flex items-center justify-center text-[#E5C687]">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-serif font-bold text-[#FAF6F0]">
                Integrated Restaurant POS &amp; Add-On Services
              </h3>
              <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                Post restaurant food orders, extra beds, laundry, airport transfers, and optional room amenities directly to the guest folio so zero billable items are missed at checkout.
              </p>
            </div>

            <div className="rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#241911] border border-[#C9A65B]/35 flex items-center justify-center text-[#E5C687]">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-serif font-bold text-[#FAF6F0]">
                Advance Deposits &amp; Multi-Mode Settlements
              </h3>
              <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                Track booking advances, partial mid-stay payments, custom discounts, and pending checkout balances with complete cashier shift audit trails.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* H2 SECTION 4: MONITOR HOTEL PERFORMANCE WITH DETAILED REPORTS */}
      <section
        id="reports"
        className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-[#0B0705] border-t border-[#C9A65B]/15"
      >
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="max-w-3xl mx-auto text-center space-y-2.5">
            <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/30 px-3 py-1 rounded-full">
              Real-Time Hotel Analytics &amp; Owner Console
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
              Monitor Hotel Performance with Detailed Reports
            </h2>
            <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed">
              Give hotel owners and managers instant visibility into daily occupancy rates, RevPAR, ADR, payment mode collections, and downloadable GST tax summaries from any device.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <div className="rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
              <h3 className="text-lg font-serif font-bold text-[#FAF6F0]">
                Daily Revenue &amp; Collection Ledgers
              </h3>
              <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                Inspect room tariff revenue, food and beverage POS sales, extra service charges, and payment mode breakdowns across Cash, UPI, and Card settlements.
              </p>
            </div>

            <div className="rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
              <h3 className="text-lg font-serif font-bold text-[#FAF6F0]">
                Occupancy, ADR &amp; RevPAR Metrics
              </h3>
              <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                Compare room category demand, seasonal occupancy trends, and booking source performance across Walk-In, Direct Website, and OTA channels.
              </p>
            </div>

            <div className="rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
              <h3 className="text-lg font-serif font-bold text-[#FAF6F0]">
                Accountant-Ready CSV &amp; GST Exports
              </h3>
              <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                Export itemized invoice registers, tax breakdowns, and guest police verification logs in one click for monthly GST filing and statutory compliance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* H2 SECTION 5: WHY CHOOSE DIRECTSTAY PMS? */}
      <section
        id="why-directstay"
        className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#0E0906] via-[#120C08] to-[#0E0906] border-t border-[#C9A65B]/15"
      >
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="max-w-3xl mx-auto text-center space-y-2.5">
            <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/30 px-3 py-1 rounded-full">
              Built for Modern Hotels, Resorts &amp; Boutique Stays
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
              Why Choose DirectStay PMS?
            </h2>
            <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed">
              DirectStay combines cloud-based hotel management software, front-desk billing, POS, and direct booking tools into a fast, intuitive platform designed for Indian hospitality teams.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="rounded-2xl bg-[#160F0A] border border-[#C9A65B]/25 p-5 space-y-2">
              <h3 className="text-base font-serif font-bold text-[#E5C687]">
                15-Minute Rapid Setup
              </h3>
              <p className="text-xs text-[#C7B9A5] leading-relaxed">
                Onboard your hotel identity, room categories, and GST billing settings in minutes without expensive hardware or IT servers.
              </p>
            </div>
            <div className="rounded-2xl bg-[#160F0A] border border-[#C9A65B]/25 p-5 space-y-2">
              <h3 className="text-base font-serif font-bold text-[#E5C687]">
                Zero Commission Direct Bookings
              </h3>
              <p className="text-xs text-[#C7B9A5] leading-relaxed">
                Keep 100% of your room revenue with flat, transparent SaaS subscriptions and zero per-booking commission fees.
              </p>
            </div>
            <div className="rounded-2xl bg-[#160F0A] border border-[#C9A65B]/25 p-5 space-y-2">
              <h3 className="text-base font-serif font-bold text-[#E5C687]">
                Role-Based Staff &amp; Owner Access
              </h3>
              <p className="text-xs text-[#C7B9A5] leading-relaxed">
                Separate Front-Desk Admin and Hotel Owner logins protect sensitive financial reports and audit logs from unauthorized edits.
              </p>
            </div>
            <div className="rounded-2xl bg-[#160F0A] border border-[#C9A65B]/25 p-5 space-y-2">
              <h3 className="text-base font-serif font-bold text-[#E5C687]">
                Dedicated Onboarding Support
              </h3>
              <p className="text-xs text-[#C7B9A5] leading-relaxed">
                Direct WhatsApp, phone, and email support for staff training, invoice customization, and property setup assistance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* H2 SECTION 6: START YOUR 7-DAY FREE TRIAL / PRICING PLANS SECTION */}
      <section
        id="pricing"
        className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#0E0906] via-[#120C08] to-[#0E0906] border-t border-[#C9A65B]/15"
      >
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="max-w-3xl mx-auto text-center space-y-2.5 mb-8 sm:mb-10">
            <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/30 px-3 py-1 rounded-full">
              DirectStay PMS – Simple. Powerful. Affordable.
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
              DirectStay PMS – Pricing Plans
            </h2>

            <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed max-w-2xl mx-auto font-normal">
              {systemWebsite.pricingSubtitle ||
                'Try DirectStay PMS free for 7 days with full access to reservations, room management, GST billing, POS, and reports. No credit card required to start — choose a transparent subscription plan anytime.'}
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6 items-stretch">
            {pricingCards.map((plan, idx) => {
              const isHighlighted = Boolean(plan.isPopular ?? plan.isHighlighted);
              const isAnnualSpecial =
                plan.planKey === 'HalfYearly' ||
                String(plan.title || '').toLowerCase().includes('annual') ||
                String(plan.priceText || '').includes('5,999');
              const isPremiumPack =
                plan.planKey === 'Yearly' ||
                String(plan.title || '').toLowerCase().includes('premium') ||
                String(plan.priceText || '').includes('17,000') ||
                String(plan.priceText || '').includes('18,000') ||
                String(plan.priceText || '').includes('12,999');

              return (
                <div
                  key={plan.id || idx}
                  className={
                    isHighlighted
                      ? 'group relative flex flex-col justify-between h-full rounded-2xl bg-gradient-to-b from-[#2B1D13] via-[#1B120C] to-[#120C08] border-2 border-[#D4AF6A] p-5 sm:p-6 shadow-[0_18px_45px_rgba(212,175,106,0.14)] hover:-translate-y-1 transition-all duration-300'
                      : 'group relative flex flex-col justify-between h-full rounded-2xl bg-gradient-to-b from-[#1D140E]/90 via-[#150E0A]/95 to-[#100A07] border border-[#C9A65B]/25 hover:border-[#DFBD78]/50 p-5 sm:p-6 shadow-[0_14px_35px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300'
                  }
                >
                  {(isHighlighted || plan.badgeText) && (
                    <div className="absolute -top-3 right-5 bg-gradient-to-r from-[#E8CB8E] via-[#D4AF6A] to-[#B88E42] text-[#120C08] text-[10px] uppercase tracking-[0.12em] font-mono font-extrabold px-3 py-0.5 rounded-full shadow-md border border-[#FAF6F0]/30">
                      {plan.badgeText || 'Most Popular'}
                    </div>
                  )}

                  <div className="flex flex-col flex-1">
                    <div className="min-h-[68px]">
                      <h3 className="text-lg sm:text-xl font-serif font-semibold text-[#FAF6F0] tracking-tight flex items-center gap-2">
                        <span>{plan.title}</span>
                        {isHighlighted && <Sparkles className="w-4 h-4 text-[#E5C687] shrink-0" />}
                      </h3>
                      <p className={`text-xs leading-relaxed mt-1.5 font-medium ${isHighlighted ? 'text-[#E5C687]' : 'text-[#C4B5A2]'}`}>
                        {plan.description}
                      </p>
                    </div>

                    {/* Price & GST Block */}
                    <div
                      className={`my-4 py-4 border-y flex flex-col justify-center ${
                        isHighlighted ? 'border-[#D4AF6A]/30' : 'border-[#C9A65B]/15'
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline gap-1.5">
                        <span
                          className={`text-3xl sm:text-4xl font-serif font-bold tracking-tight leading-none ${
                            isHighlighted ? 'text-[#E5C687]' : 'text-[#FAF6F0]'
                          }`}
                        >
                          {plan.priceText}
                        </span>
                        <span className={`text-xs font-mono ${isHighlighted ? 'text-[#D7C8B5]' : 'text-[#B7A691]'}`}>
                          {plan.periodText}
                        </span>
                        {isAnnualSpecial && (
                          <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono font-bold">
                            50% OFF
                          </span>
                        )}
                      </div>
                      {isAnnualSpecial && (
                        <p className="text-xs font-mono text-[#B7A691] mt-1">
                          Regular Price: <span className="line-through text-rose-300/90">₹11,999</span>
                        </p>
                      )}
                      <p
                        className={`text-[11px] font-mono mt-1.5 ${
                          plan.planKey === 'Trial' && !isHighlighted
                            ? 'text-[#9E8D78]'
                            : isHighlighted
                            ? 'text-[#E5C687]/90'
                            : 'text-[#D4AF6A]'
                        }`}
                      >
                        {plan.gstText}
                      </p>
                    </div>

                    {/* Feature List */}
                    <ul className={`space-y-2 text-xs sm:text-[12.5px] flex-1 ${isHighlighted ? 'text-[#F5EFE6]' : 'text-[#E6DBD0]'}`}>
                      {(plan.features || []).map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              isHighlighted
                                ? 'bg-[#D4AF6A]/20 border border-[#E5C687]/50'
                                : 'bg-[#D4AF6A]/12 border border-[#D4AF6A]/30'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5 text-[#E5C687]" />
                          </span>
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>

                    {isPremiumPack && (
                      <p className="mt-3 pt-2.5 border-t border-[#D4AF6A]/20 text-[10.5px] italic text-[#C7B9A5] leading-relaxed">
                        *OTA connections and synchronization are subject to supported integrations, OTA approvals and third-party charges.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartOnboard(plan.planKey || 'Trial')}
                    disabled={isSubmittingOnboard}
                    className={
                      isHighlighted
                        ? 'mt-5 w-full py-3 px-3 bg-gradient-to-r from-[#E8CB8E] via-[#D4AF6A] to-[#B88E42] hover:from-[#F0D7A1] hover:to-[#C89E51] text-[#120C08] font-serif font-black text-xs sm:text-[13px] tracking-wide rounded-xl transition-all duration-200 shadow-md cursor-pointer disabled:opacity-50 whitespace-normal'
                        : plan.planKey === 'Trial'
                        ? 'mt-5 w-full py-3 px-3 bg-[#241911] hover:bg-[#2F2016] text-[#FAF6F0] font-semibold text-xs sm:text-[13px] tracking-wide rounded-xl transition-all duration-200 border border-[#C9A65B]/30 hover:border-[#DFBD78]/60 cursor-pointer disabled:opacity-50 whitespace-normal'
                        : 'mt-5 w-full py-3 px-3 bg-gradient-to-r from-[#E2C281] via-[#D4AF6A] to-[#C29849] hover:from-[#EAD098] hover:to-[#CFA657] text-[#140D08] font-bold text-xs sm:text-[13px] tracking-wide rounded-xl transition-all duration-200 shadow-md cursor-pointer disabled:opacity-50 whitespace-normal'
                    }
                  >
                    {plan.planKey === 'Trial' ? 'Start 7-Day Free Trial' : plan.buttonText || 'Select Package'}
                  </button>
                  {systemWebsite.hasWhatsapp !== false && (
                    <a
                      href={buildDirectStayWhatsappUrl({
                        phone: systemWebsite.whatsappNumber || systemWebsite.supportPhone || DEFAULT_WHATSAPP_NUMBER,
                        context: 'pricing',
                        packageName: `${plan.title} (${plan.priceText} ${plan.periodText})`,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        trackSeoConversionEvent('whatsapp_click', {
                          leadSource: 'WhatsApp',
                          pagePath: '/pricing/',
                        })
                      }
                      className="mt-2 w-full py-2 px-3 rounded-xl border border-emerald-500/35 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span>💬 Ask on WhatsApp ({systemWebsite.whatsappNumber || DEFAULT_WHATSAPP_NUMBER})</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* H2 SECTION 7: FREQUENTLY ASKED QUESTIONS ABOUT HOTEL PMS & HOTELIER GUIDES */}
      <section
        id="faq"
        className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-[#0B0705] border-t border-[#C9A65B]/15"
      >
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2.5">
            <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/30 px-3 py-1 rounded-full">
              Setup, Features, Pricing, Data Security &amp; Support
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
              Frequently Asked Questions About Hotel PMS
            </h2>
            <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
              Answers to common questions from hotel owners and managers about setting up DirectStay PMS, 7-day free trial terms, GST billing, data security, and support.
            </p>
          </div>

          <div className="space-y-3">
            {HOTEL_PMS_FAQS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-gradient-to-b from-[#1B120C]/90 to-[#120C08] border border-[#C9A65B]/25 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-4 sm:px-6 py-4 text-left flex items-center justify-between gap-3 sm:gap-4 cursor-pointer whitespace-normal min-w-0"
                  >
                    <h3 className="text-sm sm:text-base font-serif font-semibold text-[#FAF6F0] whitespace-normal break-words min-w-0 flex-1">
                      {item.q}
                    </h3>
                    <ChevronDown
                      className={`w-4 h-4 text-[#E5C687] shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-5 pt-1 text-xs sm:text-sm text-[#C7B9A5] leading-relaxed border-t border-[#C9A65B]/15">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hotelier Knowledge Base & Guides (Section 8 Content Strategy) */}
          <div className="pt-8 border-t border-[#C9A65B]/15 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF6A] block">
                  Hotel Management Knowledge Base
                </span>
                <h3 className="text-xl sm:text-2xl font-serif font-semibold text-[#FAF6F0] mt-1">
                  Practical Guides for Hotel Owners &amp; Managers
                </h3>
              </div>
              <p className="text-xs text-[#B7A691] max-w-md">
                Click any guide to read actionable hospitality advice on choosing and operating a hotel property management system.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {SEO_HOTELIER_GUIDES.map((guide, gIdx) => (
                <div
                  key={guide.id}
                  className="rounded-2xl bg-[#150E0A] border border-[#C9A65B]/25 hover:border-[#DFBD78]/50 p-5 flex flex-col justify-between gap-4 transition-all"
                >
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#E5C687]">
                      <BookOpen className="w-3 h-3" />
                      <span>{guide.readTime}</span>
                    </span>
                    <h3 className="text-sm sm:text-base font-serif font-bold text-[#FAF6F0] leading-snug">
                      {guide.title}
                    </h3>
                    <p className="text-xs text-[#C4B5A2] leading-relaxed">
                      {guide.summary}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#C9A65B]/15 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveGuideIndex(gIdx)}
                      className="text-xs font-mono font-semibold text-[#E5C687] hover:text-[#FAF6F0] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Read Guide</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <a
                      href={PUBLIC_SEO_PAGES[guide.relatedPage].path}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToSeoRoute(guide.relatedPage);
                      }}
                      className="text-[11px] text-[#B7A691] hover:text-[#E5C687] underline underline-offset-2"
                    >
                      {guide.relatedLabel}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Published & Live-Scheduled CMS Blog Posts */}
            {Array.isArray(systemWebsite.blogs) &&
              systemWebsite.blogs.filter((b) => b && isCmsItemPublished(b)).length > 0 && (
                <div className="pt-8 mt-6 border-t border-[#C9A65B]/15 space-y-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF6A] block">
                      {systemWebsite.blogHeading || 'Latest DirectStay Blog Posts'}
                    </span>
                    <h3 className="text-lg sm:text-xl font-serif font-semibold text-[#FAF6F0] mt-1">
                      {systemWebsite.blogSubtitle || 'Hospitality Insights, OTA Strategies & PMS Updates'}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {systemWebsite.blogs
                      .filter((b) => b && isCmsItemPublished(b))
                      .map((blog) => (
                        <article
                          key={blog.id}
                          className="rounded-2xl bg-[#150E0A] border border-[#C9A65B]/25 hover:border-[#DFBD78]/50 overflow-hidden flex flex-col justify-between transition-all"
                        >
                          <div>
                            {blog.imageUrl && (
                              <img
                                src={blog.imageUrl}
                                alt={blog.featuredImageAlt || blog.seo?.imageAlt || blog.title}
                                className="w-full h-40 object-cover border-b border-[#C9A65B]/15"
                              />
                            )}
                            <div className="p-4 space-y-2">
                              <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#E5C687]">
                                <span className="uppercase">{blog.category || 'Hospitality'}</span>
                                <span className="text-[#B7A691]">{blog.publishedAt}</span>
                              </div>
                              <h4 className="text-sm sm:text-base font-serif font-bold text-[#FAF6F0] leading-snug">
                                {blog.title}
                              </h4>
                              <p className="text-xs text-[#C4B5A2] leading-relaxed line-clamp-3">
                                {blog.summary}
                              </p>
                              {Array.isArray(blog.tags) && blog.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {blog.tags.slice(0, 4).map((t, ti) => (
                                    <span
                                      key={ti}
                                      className="px-2 py-0.5 rounded-full bg-[#C9A65B]/10 border border-[#C9A65B]/25 text-[10px] font-mono text-[#E5C687]"
                                    >
                                      #{t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="px-4 py-3 border-t border-[#C9A65B]/15 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveCustomPage({
                                  id: blog.id,
                                  title: blog.title,
                                  slug: blog.slug || blog.id,
                                  content: blog.content,
                                  imageUrl: blog.imageUrl,
                                  featuredImageAlt: blog.featuredImageAlt || blog.seo?.imageAlt,
                                  tags: blog.tags,
                                  category: blog.category,
                                  published: true,
                                  seo: blog.seo,
                                })
                              }
                              className="text-xs font-mono font-semibold text-[#E5C687] hover:text-[#FAF6F0] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>Read Article</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <span className="text-[10px] font-mono text-[#9E8D78]">
                              {blog.readTime || '4 min read'}
                            </span>
                          </div>
                        </article>
                      ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      </section>

      {/* OUR VISION SECTION */}
      <section
        id="vision"
        className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-[#0B0705] border-t border-[#C9A65B]/15 overflow-hidden"
      >
        <div className="relative max-w-5xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-b from-[#1B120C]/90 via-[#140D09]/95 to-[#0F0A07] border border-[#C9A65B]/25 p-6 sm:p-9 lg:p-10 text-center shadow-[0_18px_45px_rgba(0,0,0,0.55)] relative overflow-hidden">
            {/* Editorial Heading */}
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.18]">
              {systemWebsite.visionTitle || 'Pioneering Commission-Free Hospitality'}
            </h3>

            {/* Vision Statement Quote */}
            <blockquote className="mt-4 text-[#EAE0D3] text-sm sm:text-lg lg:text-xl leading-relaxed font-serif italic max-w-3xl mx-auto">
              &ldquo;{systemWebsite.visionContent || 'Our vision is to bypass middleman OTAs and empower property owners to retain 100% of their profits.'}&rdquo;
            </blockquote>

            {/* Supporting Editorial Pillars */}
            {visionPillars.length > 0 && (
              <div className="mt-6 pt-6 border-t border-[#C9A65B]/15 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left sm:text-center">
                {visionPillars.map((vp, idx) => (
                  <div
                    key={vp.id || idx}
                    className={`px-3 py-1 ${idx % 3 === 1 ? 'sm:border-x border-[#C9A65B]/15' : ''}`}
                  >
                    <span className="text-xs font-serif font-bold text-[#E5C687] block">
                      {vp.title}
                    </span>
                    <p className="text-xs text-[#C7B9A5] mt-1">
                      {vp.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PRODUCT PREVIEW / TESTIMONIALS SECTION (Replaces Empty Testimonials with "See DirectStay PMS in Action") */}
      <section
        id="testimonials"
        className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#0E0906] via-[#120C08] to-[#0E0906] border-t border-[#C9A65B]/15"
      >
        <div className="max-w-7xl mx-auto">
          {systemWebsite.testimonials && systemWebsite.testimonials.length > 0 ? (
            <>
              <div className="max-w-3xl mx-auto text-center space-y-2.5 mb-8 sm:mb-10">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
                  {systemWebsite.testimonialsHeading || 'Client Success Stories'}
                </h2>
                <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed max-w-xl mx-auto font-normal">
                  {systemWebsite.testimonialsSubtitle ||
                    'See how independent properties are thriving after launching DirectStay.'}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6 items-stretch">
                {systemWebsite.testimonials.map((t) => (
                  <div
                    key={t.id}
                    className="group relative rounded-2xl bg-gradient-to-b from-[#1D140E]/90 via-[#150E0A]/95 to-[#100A07] border border-[#C9A65B]/25 hover:border-[#DFBD78]/45 p-6 sm:p-7 flex flex-col justify-between h-full shadow-[0_14px_35px_rgba(0,0,0,0.45)] transition-all duration-300"
                  >
                    <Quote className="w-8 h-8 text-[#D4AF6A]/15 absolute top-6 right-6 pointer-events-none" />
                    <div className="space-y-3.5 relative z-10">
                      <div className="flex items-center gap-1">
                        {[...Array(Math.max(1, Math.min(5, Number(t.rating) || 5)))].map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-[#E5C687] fill-[#E5C687]" />
                        ))}
                      </div>
                      <p className="text-[#EAE0D3] text-sm sm:text-base leading-relaxed font-serif italic">
                        &ldquo;{t.content}&rdquo;
                      </p>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#C9A65B]/15 pt-4 mt-5 relative z-10">
                      <div>
                        <p className="font-serif font-semibold text-[#FAF6F0] text-sm sm:text-base">
                          {t.authorName}
                        </p>
                        <p className="text-xs text-[#D4AF6A] font-mono mt-0.5">
                          {t.hotelName}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#B7A691] px-2.5 py-1 rounded-full bg-[#241911] border border-[#C9A65B]/20">
                        Verified Partner
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-8">
              <div className="max-w-3xl mx-auto text-center space-y-2.5">
                <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/30 px-3 py-1 rounded-full">
                  Interactive PMS Product Walkthrough
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
                  See DirectStay PMS in Action
                </h2>
                <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed max-w-2xl mx-auto font-normal">
                  Explore how DirectStay PMS helps hotels manage their daily operations through a single platform.
                </p>
              </div>

              {/* Interactive Product Module Tabs */}
              <div className="flex flex-wrap justify-center gap-2 max-w-full">
                {[
                  { id: 'frontdesk', label: '1. Live Room Matrix & Reservations' },
                  { id: 'checkin', label: '2. Express Check-In & Digital GRC' },
                  { id: 'billing', label: '3. GST Invoicing & Restaurant POS' },
                  { id: 'reports', label: '4. Night Audit, Finance & Police Sarai' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveWalkthroughTab(tab.id as any)}
                    className={`w-full sm:w-auto max-w-full px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-serif font-bold transition-all cursor-pointer border whitespace-normal text-center ${
                      activeWalkthroughTab === tab.id
                        ? 'bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] border-[#FAF6F0]/40 shadow-md'
                        : 'bg-[#18110B] text-[#D8CBB8] border-[#C9A65B]/25 hover:border-[#DFBD78]/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Genuine PMS Dashboard Preview Frame */}
              <div className="rounded-3xl bg-gradient-to-b from-[#1D140E] via-[#140D09] to-[#0E0906] border border-[#C9A65B]/35 p-5 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                {activeWalkthroughTab === 'frontdesk' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-5 space-y-4">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#E5C687] font-bold block">
                        Module 01 • Front-Desk Operations
                      </span>
                      <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF6F0]">
                        Real-Time Room Availability &amp; Reservation Calendar
                      </h3>
                      <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                        View every room across your property colour-coded by status: Available, Occupied, Reserved, Dirty, or Under Maintenance. Prevent double-bookings and allocate rooms in seconds.
                      </p>
                      <ul className="space-y-2 text-xs text-[#E6DBD0]">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#E5C687]" /> Date-wise Room Matrix &amp; Group Booking support</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#E5C687]" /> Instant Housekeeping status sync (Clean / Dirty / Inspect)</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#E5C687]" /> Base &amp; Max Occupancy rules with Extra Person tariffs</li>
                      </ul>
                    </div>
                    <div className="lg:col-span-7 rounded-2xl bg-[#0D0906] border border-[#C9A65B]/30 p-4 sm:p-5 font-mono text-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-[#C9A65B]/20 pb-3">
                        <span className="text-[#E5C687] font-bold">LIVE ROOM INVENTORY BOARD</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">Real-Time Sync Active</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {[
                          { rm: '101', cat: 'Standard', st: 'Available', col: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' },
                          { rm: '102', cat: 'Deluxe', st: 'Occupied', col: 'border-amber-500/40 bg-amber-950/30 text-amber-300' },
                          { rm: '201', cat: 'Executive', st: 'Reserved', col: 'border-sky-500/40 bg-sky-950/30 text-sky-300' },
                          { rm: '202', cat: 'Suite', st: 'Available', col: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' },
                          { rm: '301', cat: 'Deluxe', st: 'Occupied', col: 'border-amber-500/40 bg-amber-950/30 text-amber-300' },
                          { rm: '302', cat: 'Standard', st: 'Housekeeping', col: 'border-rose-500/40 bg-rose-950/30 text-rose-300' },
                          { rm: '303', cat: 'Executive', st: 'Available', col: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' },
                          { rm: '401', cat: 'Presidential', st: 'Occupied', col: 'border-amber-500/40 bg-amber-950/30 text-amber-300' }
                        ].map((r) => (
                          <div key={r.rm} className={`rounded-xl border p-3 ${r.col}`}>
                            <div className="font-bold text-sm text-white">Room {r.rm}</div>
                            <div className="text-[10px] opacity-80">{r.cat}</div>
                            <div className="mt-1.5 text-[10px] uppercase font-bold">{r.st}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeWalkthroughTab === 'checkin' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-5 space-y-4">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#E5C687] font-bold block">
                        Module 02 • Express Guest Check-In
                      </span>
                      <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF6F0]">
                        60-Second Walk-In Check-In &amp; Digital GRC Archival
                      </h3>
                      <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                        Capture primary and companion guest details, upload Aadhaar, Passport, or Voter ID proofs, record advance deposits, and print the statutory Guest Registration Card (GRC) in one workflow.
                      </p>
                      <ul className="space-y-2 text-xs text-[#E6DBD0]">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#E5C687]" /> Aadhaar / Passport front &amp; back document upload</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#E5C687]" /> Companion guest registry for Police Sarai Act compliance</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#E5C687]" /> Multi-room check-in &amp; mid-stay room transfer support</li>
                      </ul>
                    </div>
                    <div className="lg:col-span-7 rounded-2xl bg-[#0D0906] border border-[#C9A65B]/30 p-4 sm:p-5 font-mono text-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-[#C9A65B]/20 pb-3">
                        <span className="text-[#E5C687] font-bold">DIGITAL GUEST REGISTRATION CARD (GRC)</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#C9A65B]/20 text-[#E5C687] text-[10px]">ID Verified</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                          <span className="text-[#9E8D78] block text-[10px]">GUEST &amp; COMPANION REGISTRY</span>
                          <span className="text-white font-bold">Primary Guest + Secondary Occupants</span>
                        </div>
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                          <span className="text-[#9E8D78] block text-[10px]">GOVT ID ARCHIVAL</span>
                          <span className="text-emerald-300 font-bold">Aadhaar / Passport / Voter ID Upload</span>
                        </div>
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                          <span className="text-[#9E8D78] block text-[10px]">ROOM &amp; OCCUPANCY TARIFF</span>
                          <span className="text-white font-bold">Live Room Assignment &amp; Extra Person Rules</span>
                        </div>
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                          <span className="text-[#9E8D78] block text-[10px]">ADVANCE DEPOSIT LEDGER</span>
                          <span className="text-[#E5C687] font-bold">Cash / UPI / Card / Bank Receipt Sync</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeWalkthroughTab === 'billing' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-5 space-y-4">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#E5C687] font-bold block">
                        Module 03 • GST Billing &amp; Restaurant POS
                      </span>
                      <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF6F0]">
                        Automated Stay Folios, Room Service POS &amp; GST Tax Invoices
                      </h3>
                      <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                        Every restaurant KOT/POS order, laundry charge, extra bed, and water bottle allocation automatically posts to the room folio so checkout billing is 100% accurate.
                      </p>
                      <ul className="space-y-2 text-xs text-[#E6DBD0]">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#E5C687]" /> Configurable 5% / 12% / 18% CGST &amp; SGST slabs + B2B GSTIN</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#E5C687]" /> Split settlements across Cash, UPI, Card &amp; Bank Transfer</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#E5C687]" /> Instant A4 Tax Invoice &amp; Thermal POS Receipt printing</li>
                      </ul>
                    </div>
                    <div className="lg:col-span-7 rounded-2xl bg-[#0D0906] border border-[#C9A65B]/30 p-4 sm:p-5 font-mono text-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-[#C9A65B]/20 pb-3">
                        <span className="text-[#E5C687] font-bold">CONSOLIDATED GUEST CHECKOUT FOLIO</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">GST Ready</span>
                      </div>
                      <div className="space-y-2 text-[11px]">
                        <div className="flex justify-between py-1.5 border-b border-white/10"><span>Room Tariff × Stay Duration + Extra Guest Charges</span><span className="text-white font-bold">Auto-Calculated</span></div>
                        <div className="flex justify-between py-1.5 border-b border-white/10"><span>Restaurant POS, Laundry &amp; Room Service Orders</span><span className="text-white font-bold">Live Folio Sync</span></div>
                        <div className="flex justify-between py-1.5 border-b border-white/10"><span>Configurable CGST + SGST (5% / 12% / 18%)</span><span className="text-[#E5C687] font-bold">GST Compliant</span></div>
                        <div className="flex justify-between py-1.5 text-sm font-bold text-emerald-300"><span>Net Payable Folio Settlement</span><span>A4 &amp; Thermal Print</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {activeWalkthroughTab === 'reports' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-5 space-y-4">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#E5C687] font-bold block">
                        Module 04 • Finance Hub &amp; Compliance Reports
                      </span>
                      <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF6F0]">
                        Date-to-Date Financial Ledgers, Night Audit &amp; Form &lsquo;C&rsquo; Sarai Register
                      </h3>
                      <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                        Export exact Date-to-Date CSV/Excel statements for Daily Cash Handover, Night Audit, Pending Receivables, GSTR-1 Tax Slabs, Expense Vouchers, and Police Sarai compliance.
                      </p>
                      <ul className="space-y-2 text-xs text-[#E6DBD0]">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#E5C687]" /> Custom From-Date to To-Date Excel/CSV &amp; PDF exports</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#E5C687]" /> 10-Module Finance Hub (Cash/Bank, Petty Cash, Vouchers, Vendors)</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#E5C687]" /> One-click Police Sarai Act &amp; Form &lsquo;C&rsquo; guest register</li>
                      </ul>
                    </div>
                    <div className="lg:col-span-7 rounded-2xl bg-[#0D0906] border border-[#C9A65B]/30 p-4 sm:p-5 font-mono text-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-[#C9A65B]/20 pb-3">
                        <span className="text-[#E5C687] font-bold">OWNER FINANCIAL &amp; AUDIT CONSOLE</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#C9A65B]/20 text-[#E5C687] text-[10px]">Date-to-Date CSV Export</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10"><span className="text-[#9E8D78] block text-[10px]">DAILY CASH DRAWER</span><span className="text-emerald-300 font-bold">Reconciled ✓</span></div>
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10"><span className="text-[#9E8D78] block text-[10px]">GSTR-1 TAX LEDGER</span><span className="text-white font-bold">5% &amp; 18% Slabs</span></div>
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10"><span className="text-[#9E8D78] block text-[10px]">POLICE SARAI LOG</span><span className="text-[#E5C687] font-bold">Form &lsquo;C&rsquo; Ready</span></div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 pt-5 border-t border-[#C9A65B]/20 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs text-[#C7B9A5]">
                    Ready to test all modules with your own hotel rooms? Start your 7-day free trial with zero upfront cost.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleStartOnboard('Trial')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E2C281] via-[#D4AF6A] to-[#C29849] text-[#140D08] font-bold text-xs tracking-wide shadow-md hover:brightness-105 transition-all cursor-pointer"
                    >
                      <span>Start Your 7-Day Free Trial</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmedDemoBooking(null);
                        setShowDemoModal(true);
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#241911] hover:bg-[#2F2016] text-[#EAE0D3] border border-[#C9A65B]/35 text-xs font-medium transition-all cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-[#E5C687]" />
                      <span>Book a Free Demo</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* DYNAMIC CUSTOM SECTIONS ADDED VIA SUPER ADMIN WEBSITE CMS */}
      {customSections.map((sec, secIdx) => (
        <section
          key={sec.id || secIdx}
          id={`custom-section-${sec.id || secIdx}`}
          className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#0B0705] via-[#120C08] to-[#0E0906] border-t border-[#C9A65B]/15"
        >
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="max-w-3xl mx-auto text-center space-y-2.5">
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
                {sec.heading}
              </h3>
              {sec.subtitle && (
                <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed max-w-2xl mx-auto font-normal">
                  {sec.subtitle}
                </p>
              )}
            </div>

            {sec.items && sec.items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
                {sec.items.map((item, iIdx) => (
                  <div
                    key={item.id || iIdx}
                    className="group relative h-full flex flex-col justify-between bg-gradient-to-b from-[#1B130C]/95 to-[#120C07]/95 border border-[#C5A059]/25 hover:border-[#DFBD78]/60 rounded-2xl p-6 sm:p-7 shadow-[0_12px_32px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="space-y-3">
                      {item.badgeText && (
                        <span className="inline-block text-[10px] font-mono uppercase tracking-[0.15em] text-[#E5C687] bg-[#241911] border border-[#C9A65B]/30 px-2.5 py-0.5 rounded-full">
                          {item.badgeText}
                        </span>
                      )}
                      <h3 className="text-lg sm:text-xl font-serif font-bold text-[#FAF6F0] tracking-tight group-hover:text-[#F2D69B] transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-[#D8CBB8]/80 text-xs sm:text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {item.bullets && item.bullets.length > 0 && (
                      <div className="pt-4 mt-5 border-t border-[#C5A059]/15 space-y-2 text-xs text-[#C8B8A4] font-medium">
                        {item.bullets.map((bp, bpIdx) => (
                          <div key={bpIdx} className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-[#C5A059]/15 border border-[#C5A059]/45 flex items-center justify-center text-[#DFBD78] shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                            </span>
                            <span>{bp}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}

      {/* CONTACT US SECTION */}
      <section
        id="contact"
        className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-[#0B0705] border-t border-[#C9A65B]/15"
      >
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Section Header */}
          <div className="max-w-2xl mx-auto text-center space-y-2.5">
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
              {systemWebsite.contactHeading || "Let's Discuss Your Growth"}
            </h3>

            <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed max-w-xl mx-auto font-normal">
              {systemWebsite.contactSubtitle ||
                'Get in touch directly with our support specialists for product demonstrations, subscription enquiries, onboarding and hotel management software support.'}
            </p>
          </div>

          {/* 3 Equal-Height Contact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
            {/* Card 1: Email Us */}
            <div className="group rounded-2xl bg-gradient-to-b from-[#1D140E]/90 via-[#150E0A]/95 to-[#100A07] border border-[#C9A65B]/25 hover:border-[#DFBD78]/50 p-6 flex flex-col justify-between text-center shadow-[0_14px_35px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2A1D13] to-[#17100A] border border-[#C9A65B]/35 flex items-center justify-center mx-auto text-[#E5C687] group-hover:border-[#E5C687]/60 transition-colors">
                  <Mail className="w-4 h-4 stroke-[1.8]" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#FAF6F0]">
                    {systemWebsite.contactEmailTitle || 'Email Us'}
                  </h3>
                  <p className="text-[11px] text-[#9E8D78] mt-0.5">
                    {systemWebsite.contactEmailSubtitle || 'Direct Enterprise & Onboarding Desk'}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#C9A65B]/15">
                <a
                  href={`mailto:${systemWebsite.supportEmail}`}
                  className="text-xs sm:text-sm text-[#E5C687] hover:text-[#FAF6F0] hover:underline font-mono font-medium break-all transition-colors"
                >
                  {systemWebsite.supportEmail}
                </a>
              </div>
            </div>

            {/* Card 2: Call Helpline */}
            <div className="group rounded-2xl bg-gradient-to-b from-[#1D140E]/90 via-[#150E0A]/95 to-[#100A07] border border-[#C9A65B]/25 hover:border-[#DFBD78]/50 p-6 flex flex-col justify-between text-center shadow-[0_14px_35px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2A1D13] to-[#17100A] border border-[#C9A65B]/35 flex items-center justify-center mx-auto text-[#E5C687] group-hover:border-[#E5C687]/60 transition-colors">
                  <Phone className="w-4 h-4 stroke-[1.8]" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#FAF6F0]">
                    {systemWebsite.contactPhoneTitle || 'Call Helpline'}
                  </h3>
                  <p className="text-[11px] text-[#9E8D78] mt-0.5">
                    {systemWebsite.contactPhoneSubtitle || 'Priority Setup & Technical Support Line'}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#C9A65B]/15">
                <a
                  href={telHref}
                  className="text-sm sm:text-base text-[#E5C687] hover:text-[#FAF6F0] hover:underline font-mono font-bold tracking-wide transition-colors"
                >
                  {formattedSupportPhone}
                </a>
              </div>
            </div>

            {/* Card 3: Headquarters */}
            <div className="group rounded-2xl bg-gradient-to-b from-[#1D140E]/90 via-[#150E0A]/95 to-[#100A07] border border-[#C9A65B]/25 hover:border-[#DFBD78]/50 p-6 flex flex-col justify-between text-center shadow-[0_14px_35px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2A1D13] to-[#17100A] border border-[#C9A65B]/35 flex items-center justify-center mx-auto text-[#E5C687] group-hover:border-[#E5C687]/60 transition-colors">
                  <MapPin className="w-4 h-4 stroke-[1.8]" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#FAF6F0]">
                    {systemWebsite.contactAddressTitle || 'Headquarters'}
                  </h3>
                  <p className="text-[11px] text-[#9E8D78] mt-0.5">
                    {systemWebsite.contactAddressSubtitle || 'Registered Hospitality Operations Hub'}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#C9A65B]/15">
                <p className="text-xs sm:text-sm text-[#EAE0D3] font-serif leading-relaxed">
                  {systemWebsite.contactAddress}
                </p>
              </div>
            </div>
          </div>

          {/* Direct Contact & Demo Enquiry Form (Fires contact_form_submission event) */}
          <div className="rounded-2xl bg-gradient-to-b from-[#1B120C]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 sm:p-8 shadow-[0_14px_35px_rgba(0,0,0,0.45)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-5 space-y-2.5">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] block">
                  Demo &amp; Subscription Enquiry Desk
                </span>
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF6F0]">
                  Send an Enquiry or Request Onboarding Support
                </h3>
                <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                  Share your hotel details below and our DirectStay onboarding specialists will assist you with a live product demonstration, room inventory setup, or custom GST invoice configuration.
                </p>
              </div>

              <form onSubmit={handleContactFormSubmit} className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <input
                  type="text"
                  required
                  placeholder="Your Name *"
                  value={contactFormName}
                  onChange={(e) => setContactFormName(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-black/40 border border-[#C9A65B]/25 rounded-xl px-3.5 py-2.5 text-[#FAF6F0] placeholder-[#9E8D78] focus:border-[#E5C687] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Hotel / Property Name"
                  value={contactFormHotel}
                  onChange={(e) => setContactFormHotel(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-black/40 border border-[#C9A65B]/25 rounded-xl px-3.5 py-2.5 text-[#FAF6F0] placeholder-[#9E8D78] focus:border-[#E5C687] focus:outline-none"
                />
                <input
                  type="tel"
                  required
                  placeholder="Phone / WhatsApp Number *"
                  value={contactFormPhone}
                  onChange={(e) => setContactFormPhone(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-black/40 border border-[#C9A65B]/25 rounded-xl px-3.5 py-2.5 text-[#FAF6F0] placeholder-[#9E8D78] focus:border-[#E5C687] focus:outline-none"
                />
                <select
                  value={contactFormTopic}
                  onChange={(e) => setContactFormTopic(e.target.value)}
                  aria-label="Enquiry Topic"
                  className="w-full text-xs sm:text-sm bg-[#140D09] border border-[#C9A65B]/25 rounded-xl px-3.5 py-2.5 text-[#FAF6F0] focus:border-[#E5C687] focus:outline-none"
                >
                  <option value="Product Demo">Request Product Demo</option>
                  <option value="7-Day Free Trial Setup">7-Day Free Trial Setup</option>
                  <option value="Subscription Pricing">Subscription Pricing Enquiry</option>
                  <option value="Technical Support">Hotel PMS Technical Support</option>
                </select>
                <textarea
                  rows={2}
                  placeholder="Tell us about your hotel rooms or requirements (optional)"
                  value={contactFormMessage}
                  onChange={(e) => setContactFormMessage(e.target.value)}
                  className="sm:col-span-2 w-full text-xs sm:text-sm bg-black/40 border border-[#C9A65B]/25 rounded-xl px-3.5 py-2 text-[#FAF6F0] placeholder-[#9E8D78] focus:border-[#E5C687] focus:outline-none resize-none"
                />
                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-[11px] text-[#9E8D78]">
                    {contactFormSubmitted
                      ? '✓ Enquiry recorded! Our onboarding specialist will contact you shortly.'
                      : 'We respect your privacy and never share hotel contact details.'}
                  </span>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-black text-xs tracking-wide shadow-md cursor-pointer"
                  >
                    <span>Submit Hotel Enquiry</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* FLOATING WHATSAPP BUTTON (Fires whatsapp_click event) */}
      {systemWebsite.hasWhatsapp !== false && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackSeoConversionEvent('whatsapp_click', {
              leadSource: 'WhatsApp',
              pagePath: typeof window !== 'undefined' ? window.location.pathname : '/'
            })
          }
          aria-label="Chat on WhatsApp"
          title={`WhatsApp Live Chat (+${whatsappNumberDigits})`}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white flex items-center justify-center shadow-[0_8px_28px_rgba(37,211,102,0.45)] hover:shadow-[0_12px_36px_rgba(37,211,102,0.65)] hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/25 cursor-pointer"
        >
          <svg
            className="w-7 h-7 fill-current"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M20.52 3.48A11.82 11.82 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.95L0 24l6.33-1.66a11.86 11.86 0 0 0 5.73 1.46h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.44-8.42ZM12.07 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.75.98 1-3.66-.24-.37a9.85 9.85 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.13 1.03 7 2.9a9.83 9.83 0 0 1 2.89 7c0 5.45-4.44 9.89-9.89 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
          </svg>
        </a>
      )}

      {/* FOOTER */}
      <footer className="border-t border-[#C9A65B]/20 bg-[#080503] text-[#C7B9A5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 pb-8 border-b border-[#C9A65B]/15">
            {/* Brand Column */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-3">
                {systemWebsite.logoUrl ? (
                  <img
                    src={systemWebsite.logoUrl}
                    alt={`${systemWebsite.businessName || 'DirectStay'} Hotel Management Software Logo`}
                    className="w-10 h-10 object-cover rounded-xl border border-[#DFBD78]/40"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-b from-[#E5C687] via-[#D4AF6A] to-[#B68D43] rounded-xl flex items-center justify-center text-[#120C08] border border-[#F5DFA3]/40">
                    <Hotel className="w-5 h-5 stroke-[2.2]" />
                  </div>
                )}
                <div className="text-left leading-tight">
                  <span className="text-[9.5px] uppercase font-mono tracking-[0.2em] text-[#D4AF6A] block font-bold">
                    {systemWebsite.footerTagline || 'Boutique SaaS System'}
                  </span>
                  <span className="font-serif font-bold text-[#FAF6F0] text-xl tracking-tight">
                    {systemWebsite.businessName || 'DirectStay'}
                  </span>
                </div>
              </div>
              <p className="text-xs sm:text-[13px] text-[#A89882] leading-relaxed max-w-sm">
                {systemWebsite.footerDescription ||
                  'Commission-free Hotel Property Management & Direct Booking SaaS built for independent boutique hotels, resorts, and heritage stays.'}
              </p>
            </div>

            {/* Platform Navigation (Internal SEO Links) */}
            <div className="lg:col-span-3 space-y-3">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5C687] font-semibold">
                {systemWebsite.footerPlatformTitle || 'Hotel PMS Solutions'}
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-[13px]">
                <li>
                  <a
                    href="/features/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSeoRoute('features', 'features');
                    }}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    Hotel PMS Features
                  </a>
                </li>
                <li>
                  <a
                    href="/hotel-reservation-software/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSeoRoute('hotel-reservation-software', 'reservations');
                    }}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    Hotel Reservation Software
                  </a>
                </li>
                <li>
                  <a
                    href="/hotel-billing-software/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSeoRoute('hotel-billing-software', 'billing');
                    }}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    Hotel Billing &amp; Invoice Software
                  </a>
                </li>
                <li>
                  <a
                    href="/pricing/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSeoRoute('pricing', 'pricing');
                    }}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    Hotel Management Software Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="/free-trial/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSeoRoute('free-trial', 'pricing');
                    }}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    7-Day Free Trial
                  </a>
                </li>
              </ul>
            </div>

            {/* Architecture & Portals */}
            <div className="lg:col-span-3 space-y-3">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5C687] font-semibold">
                {systemWebsite.footerEnterpriseTitle || 'Company & Portals'}
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-[13px]">
                <li>
                  <a
                    href="/about/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSeoRoute('about', 'vision');
                    }}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    About DirectStay PMS
                  </a>
                </li>
                <li>
                  <a
                    href="/contact/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSeoRoute('contact', 'contact');
                    }}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    Contact &amp; Product Demo
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openNamedCustomPage('security', INITIAL_CUSTOM_PAGES[1])}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    Data Security &amp; Isolation
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onNavigateToLogin}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    {systemWebsite.navSignInText || 'Sign In Console'}
                  </button>
                </li>
                {publishedCustomPages
                  .filter((p) => p.showInFooter !== false)
                  .slice(0, 6)
                  .map((p) => (
                    <li key={`footer-cms-${p.id}`}>
                      <a
                        href={`/page/${p.slug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveCustomPage(p);
                          if (typeof window !== 'undefined') {
                            window.history.pushState({}, '', `/page/${p.slug}`);
                          }
                        }}
                        className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                      >
                        {p.title}
                      </a>
                    </li>
                  ))}
                <li>
                  <a
                    href="/sitemap.xml"
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    XML Sitemap
                  </a>
                </li>
              </ul>
            </div>

            {/* Direct Contact Summary */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5C687] font-semibold">
                {systemWebsite.footerDirectDeskTitle || 'Direct Desk'}
              </h3>
              <ul className="space-y-2.5 text-xs text-[#B7A691]">
                <li>
                  <a
                    href={`mailto:${systemWebsite.supportEmail}`}
                    className="hover:text-[#E5C687] break-all font-mono transition-colors"
                  >
                    {systemWebsite.supportEmail}
                  </a>
                </li>
                <li>
                  <a
                    href={telHref}
                    className="hover:text-[#E5C687] font-mono font-semibold transition-colors"
                  >
                    {formattedSupportPhone}
                  </a>
                </li>
                <li className="text-[11px] text-[#9E8D78] leading-relaxed">
                  {systemWebsite.contactAddress}
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Legal & Tax Disclaimer Bar */}
          <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#9E8D78] text-center md:text-left">
            <p className="font-mono text-[11px] sm:text-xs text-[#B7A691]">
              {`© 2026 DirectStay Luxury Cloud PMS. Powered by DirectStay SaaS. • Software Version 2.0 • Email: ${systemWebsite.supportEmail || 'contact@directstay.online'} • Support: ${formattedSupportPhone}`}
            </p>
            <p className="text-[11px] text-[#9E8D78]">
              {systemWebsite.footerGstDisclaimer ||
                'All listed premium plan packages are subject to 18% GST standard regulations.'}
            </p>
          </div>
        </div>
      </footer>

      {/* CALENDLY DEMO BOOKING MODAL: DirectStay PMS — Free 15-Minute Demo (Fires demo_booking conversion event) */}
      {showDemoModal && (
        <div
          onClick={() => setShowDemoModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1C140E] border border-[#C9A65B]/40 rounded-2xl sm:rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto"
          >
            <div className="bg-[#120C08] px-6 py-4 border-b border-[#C9A65B]/20 flex items-center justify-between sticky top-0 z-10">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#E5C687] block">
                  Calendly Appointment Scheduling • 15-Minute Live Walkthrough
                </span>
                <h3 className="font-serif font-bold text-lg text-[#FAF6F0]">
                  DirectStay PMS — Free 15-Minute Demo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-rose-500/20 text-[#FAF6F0] border border-[#C5A059]/30 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {confirmedDemoBooking ? (
              <div className="p-6 space-y-5">
                <div className="rounded-2xl bg-emerald-950/40 border border-emerald-500/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                    <CheckCircle className="w-5 h-5 shrink-0" />
                    <span>Demo Appointment Confirmed!</span>
                  </div>
                  <p className="text-xs text-[#EAE0D3] leading-relaxed">
                    Your <strong>DirectStay PMS — Free 15-Minute Demo</strong> is scheduled for <strong>{confirmedDemoBooking.date}</strong> at <strong>{confirmedDemoBooking.slot}</strong>. A confirmation and reminder notification have been queued for <strong>{confirmedDemoBooking.email}</strong> and WhatsApp <strong>{confirmedDemoBooking.phone}</strong>.
                  </p>
                </div>

                <div className="rounded-xl bg-black/40 border border-[#C9A65B]/25 p-4 font-mono text-xs space-y-1.5 text-[#D8CBB8]">
                  <div><strong className="text-[#E5C687]">Event:</strong> DirectStay PMS — Free 15-Minute Demo</div>
                  <div><strong className="text-[#E5C687]">Attendee:</strong> {confirmedDemoBooking.name} ({confirmedDemoBooking.hotelName})</div>
                  <div><strong className="text-[#E5C687]">City &amp; Rooms:</strong> {confirmedDemoBooking.city} • {confirmedDemoBooking.rooms} Rooms</div>
                  <div><strong className="text-[#E5C687]">Scheduled Slot:</strong> {confirmedDemoBooking.date} ({confirmedDemoBooking.slot})</div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#C9A65B]/15">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmedDemoBooking(null)}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-[#FAF6F0] font-mono cursor-pointer"
                    >
                      Reschedule Slot
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelDemoBooking(confirmedDemoBooking.id)}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-xs text-rose-300 font-mono cursor-pointer"
                    >
                      Cancel Booking
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDemoModal(false);
                      handleStartOnboard('Trial');
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-black text-xs shadow-md cursor-pointer"
                  >
                    <span>Start Your 7-Day Free Trial Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBookDemoSubmit} className="p-6 space-y-4">
                <p className="text-xs text-[#C7B9A5] leading-relaxed">
                  Select a convenient 15-minute slot connected to our hospitality specialist calendar, or start your 7-day free trial immediately with no credit card required.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono uppercase text-[#E5C687] block mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rajesh Sharma"
                      value={demoName}
                      onChange={(e) => setDemoName(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#C9A65B]/30 rounded-xl px-3.5 py-2.5 text-white focus:border-[#E5C687] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono uppercase text-[#E5C687] block mb-1">
                      Hotel / Property Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Grand Heritage Residency"
                      value={demoHotelName}
                      onChange={(e) => setDemoHotelName(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#C9A65B]/30 rounded-xl px-3.5 py-2.5 text-white focus:border-[#E5C687] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono uppercase text-[#E5C687] block mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="owner@yourhotel.com"
                      value={demoEmail}
                      onChange={(e) => setDemoEmail(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#C9A65B]/30 rounded-xl px-3.5 py-2.5 text-white focus:border-[#E5C687] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono uppercase text-[#E5C687] block mb-1">
                      Phone / WhatsApp Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={demoPhone}
                      onChange={(e) => setDemoPhone(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#C9A65B]/30 rounded-xl px-3.5 py-2.5 text-white focus:border-[#E5C687] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono uppercase text-[#E5C687] block mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Puri / Jaipur / Manali"
                      value={demoCity}
                      onChange={(e) => setDemoCity(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#C9A65B]/30 rounded-xl px-3.5 py-2.5 text-white focus:border-[#E5C687] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono uppercase text-[#E5C687] block mb-1">
                      Approximate Number of Rooms *
                    </label>
                    <select
                      value={demoRooms}
                      onChange={(e) => setDemoRooms(e.target.value)}
                      aria-label="Number of Rooms"
                      className="w-full text-sm bg-[#120C08] border border-[#C9A65B]/30 rounded-xl px-3.5 py-2.5 text-white focus:border-[#E5C687] focus:outline-none"
                    >
                      <option value="1-10">1 to 10 Rooms</option>
                      <option value="10-20">10 to 20 Rooms</option>
                      <option value="20-30">20 to 30 Rooms</option>
                      <option value="30-50">30 to 50+ Rooms</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-mono uppercase text-[#E5C687] block mb-1">
                      Preferred Demo Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().substring(0, 10)}
                      value={demoDate}
                      onChange={(e) => setDemoDate(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#C9A65B]/30 rounded-xl px-3.5 py-2.5 text-white font-mono focus:border-[#E5C687] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono uppercase text-[#E5C687] block mb-1">
                      Available 15-Min Calendar Slot *
                    </label>
                    <select
                      value={demoPreferredTime}
                      onChange={(e) => setDemoPreferredTime(e.target.value)}
                      aria-label="Available 15-Min Calendar Slot"
                      className="w-full text-sm bg-[#120C08] border border-[#C9A65B]/30 rounded-xl px-3.5 py-2.5 text-white focus:border-[#E5C687] focus:outline-none"
                    >
                      {DEMO_TIME_SLOTS.map((slot) => {
                        const booked = isDemoSlotBooked(demoDate, slot);
                        return (
                          <option key={slot} value={slot} disabled={booked}>
                            {slot} {booked ? '(Booked)' : '(Available)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#C9A65B]/15 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDemoModal(false);
                      handleStartOnboard('Trial');
                    }}
                    className="text-xs font-mono text-[#E5C687] hover:underline cursor-pointer"
                  >
                    Or Start Your 7-Day Free Trial Now →
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-black text-xs shadow-md cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Schedule 15-Min Demo</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* HOTELIER GUIDE ARTICLE MODAL (Section 8 Content Strategy) */}
      {activeGuideIndex !== null && SEO_HOTELIER_GUIDES[activeGuideIndex] && (
        <div
          onClick={() => setActiveGuideIndex(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1C140E] border border-[#C9A65B]/40 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden"
          >
            <div className="bg-[#120C08] px-6 py-4 border-b border-[#C9A65B]/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#E5C687] block">
                  DirectStay Hotelier Resource Guide • {SEO_HOTELIER_GUIDES[activeGuideIndex].readTime}
                </span>
                <h3 className="font-serif font-bold text-lg sm:text-xl text-[#FAF6F0]">
                  {SEO_HOTELIER_GUIDES[activeGuideIndex].title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveGuideIndex(null)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-rose-500/20 text-[#FAF6F0] border border-[#C5A059]/30 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {SEO_HOTELIER_GUIDES[activeGuideIndex].content.map((para, pIdx) => (
                <p key={pIdx} className="text-sm sm:text-base text-[#EAE0D3] leading-relaxed font-serif">
                  {para}
                </p>
              ))}
              <div className="pt-3 border-t border-[#C9A65B]/15 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={PUBLIC_SEO_PAGES[SEO_HOTELIER_GUIDES[activeGuideIndex].relatedPage].path}
                  onClick={(e) => {
                    e.preventDefault();
                    const route = SEO_HOTELIER_GUIDES[activeGuideIndex!].relatedPage;
                    setActiveGuideIndex(null);
                    navigateToSeoRoute(route);
                  }}
                  className="inline-flex items-center gap-2 text-xs font-mono font-bold text-[#E5C687] hover:underline"
                >
                  <span>{SEO_HOTELIER_GUIDES[activeGuideIndex].relatedLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setActiveGuideIndex(null);
                    handleStartOnboard('Trial');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-black text-xs shadow-md cursor-pointer"
                >
                  <span>Start 7-Day Free Trial</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING DIALOG WIZARD MODAL */}
      {showWizard && (
        <div
          onClick={() => {
            if (currentStep !== 'processing') setShowWizard(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1C140E] border border-luxury-gold-500/35 rounded-2xl sm:rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden relative"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-luxury-gold-500 to-transparent z-20" />
            
            {/* Sticky Top Header with Prominent Cross (X) Button */}
            <div className="bg-[#120C08] px-5 py-3.5 border-b border-luxury-gold-500/15 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-white">Setup Your New Tenant PMS</h3>
              </div>
              {currentStep !== 'processing' && (
                <button 
                  type="button"
                  onClick={() => setShowWizard(false)}
                  aria-label="Close onboarding modal"
                  title="Close"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-rose-500/20 text-[#FAF6F0] hover:text-rose-300 border border-[#C5A059]/30 hover:border-rose-400/50 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              )}
            </div>

            {/* Stepper Wizard Indicator */}
            {currentStep !== 'processing' && (
              <div className="bg-black/40 px-3 sm:px-5 py-2.5 border-b border-luxury-gold-500/10 flex items-center justify-between gap-1 text-[10px] sm:text-xs font-mono text-luxury-brown-300 shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrentStep('branding')}
                  className={`cursor-pointer hover:text-white truncate ${currentStep === 'branding' ? 'text-luxury-gold-400 font-bold' : ''}`}
                >
                  1. Hotel Identity
                </button>
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <button
                  type="button"
                  onClick={() => setCurrentStep('inventory')}
                  className={`cursor-pointer hover:text-white truncate ${currentStep === 'inventory' ? 'text-luxury-gold-400 font-bold' : ''}`}
                >
                  2. Room Tier Setup
                </button>
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <button
                  type="button"
                  onClick={() => setCurrentStep('payment')}
                  className={`cursor-pointer hover:text-white truncate ${currentStep === 'payment' ? 'text-luxury-gold-400 font-bold' : ''}`}
                >
                  3. Billing Checkout
                </button>
              </div>
            )}

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1">
            {/* Step Content: 1. BRANDING & CONTACT */}
            {currentStep === 'branding' && (
              <div className="p-5 space-y-3.5">
                <div className="rounded-xl bg-[#241911] border border-[#C9A65B]/30 px-3.5 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-[#E5C687] font-mono font-bold">
                    {selectedPlan === 'Trial' ? '✓ 7-Day Free Trial (₹0 — No Credit Card Required)' : `Selected Plan: ${planDetails.name}`}
                  </span>
                  <span className="text-[11px] text-[#C7B9A5]">Quick 2-Minute Setup</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase text-luxury-gold-300 block font-bold">Your Full Name *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Rajesh Sharma"
                      value={ownerFullName}
                      onChange={(e) => setOwnerFullName(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-3.5 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase text-luxury-gold-300 block font-bold">Hotel / Property Name *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Sea Shell Palace"
                      value={hotelName}
                      onChange={(e) => setHotelName(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-3.5 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase text-luxury-gold-300 block font-bold">Email Address *</label>
                    <input 
                      type="email" 
                      required
                      placeholder="e.g. owner@seashellhotel.com"
                      value={hotelEmail}
                      onChange={(e) => setHotelEmail(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-3.5 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase text-luxury-gold-300 block font-bold">Mobile Number *</label>
                    <input 
                      type="tel" 
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={hotelPhone}
                      onChange={(e) => setHotelPhone(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-3.5 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase text-luxury-gold-300 block font-bold">City *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Puri / Jaipur"
                      value={hotelCity}
                      onChange={(e) => setHotelCity(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-3.5 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase text-luxury-gold-300 block font-bold">Country *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="India"
                      value={hotelCountry}
                      onChange={(e) => setHotelCountry(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-3.5 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase text-luxury-gold-300 block font-bold">GSTIN (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="Optional GSTIN"
                      value={hotelGst}
                      onChange={(e) => setHotelGst(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-3.5 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase text-luxury-gold-300 block font-bold">Property Street Address (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. Marine Drive Road, Near Golden Beach"
                    value={hotelAddress}
                    onChange={(e) => setHotelAddress(e.target.value)}
                    className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-3.5 py-2 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase text-luxury-gold-300 block font-bold">Admin Username *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. seashell_admin"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-3.5 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase text-luxury-gold-300 block font-bold">Admin Password *</label>
                    <input 
                      type="password" 
                      required
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-3.5 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase text-luxury-gold-300 block font-bold">Confirm Password *</label>
                    <input 
                      type="password" 
                      required
                      placeholder="••••••••"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-3.5 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* LOGO MOCK UPLOAD SECTION */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-luxury-gold-300 block font-bold">Property Brand Logo Upload</label>
                  
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-4 text-center transition-all flex flex-col items-center justify-center gap-1.5 ${dragActive ? 'border-luxury-gold-500 bg-luxury-gold-500/10' : 'border-[#8C7355]/30 bg-black/20 hover:border-luxury-gold-500/30'}`}
                  >
                    <input 
                      type="file" 
                      id="logo-upload-input"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    
                    {logoBase64 ? (
                      <div className="flex items-center gap-4">
                        <img 
                          src={logoBase64} 
                          alt="Uploaded Brand Logo" 
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-lg object-cover border border-luxury-gold-500/30 shadow-md"
                        />
                        <div className="text-left">
                          <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Logo Cached Successfully!
                          </span>
                          <button 
                            type="button" 
                            onClick={() => setLogoBase64('')}
                            className="text-[10px] text-rose-400 underline hover:text-rose-300 mt-1 block"
                          >
                            Remove Logo Image
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="logo-upload-input" className="cursor-pointer space-y-1 block">
                        <Upload className="w-5 h-5 text-luxury-gold-400 mx-auto" />
                        <p className="text-xs text-luxury-beige-100 font-bold">Drag and drop or Click to upload logo image</p>
                        <p className="text-[10px] text-luxury-brown-300 font-mono">Supports PNG, JPG (Reads to local base64 preview)</p>
                      </label>
                    )}
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="pt-3 border-t border-luxury-gold-500/10 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setShowWizard(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-luxury-brown-200 hover:text-white text-xs font-mono font-bold border border-white/10 transition-colors cursor-pointer"
                  >
                    ✕ Cancel
                  </button>
                  <button 
                    onClick={() => {
                      if (!ownerFullName.trim() || !hotelName.trim() || !hotelEmail.trim() || !hotelPhone.trim() || !hotelCity.trim()) {
                        showToast('Please fill in Your Full Name, Hotel Name, Email, Mobile Number, and City.', 'warning');
                        return;
                      }
                      if (!regUsername.trim()) {
                        showToast('Please fill in the Admin Username to proceed.', 'warning');
                        return;
                      }
                      if (!regPassword) {
                        showToast('Please fill in the Admin Password to proceed.', 'warning');
                        return;
                      }
                      if (regPassword !== regConfirmPassword) {
                        showToast('Confirm Password must match the Password.', 'error');
                        return;
                      }
                      const { hotels = [] } = getPmsData();
                      const cleanUser = regUsername.trim().toLowerCase();
                      const cleanEmail = hotelEmail.trim().toLowerCase();
                      const cleanPhone = hotelPhone.replace(/\D/g, '').slice(-10);

                      const usernameExists = hotels.some(
                        h => h.username && h.username.trim().toLowerCase() === cleanUser
                      );
                      if (usernameExists) {
                        showToast('Username is already taken. Please choose a unique Username.', 'error');
                        return;
                      }

                      // Prevent duplicate account creation & repeated free-trial abuse
                      const duplicateAccount = hotels.some(h => {
                        const hEmail = (h.emailAddress || '').trim().toLowerCase();
                        const hPhone = (h.phoneNumber || '').replace(/\D/g, '').slice(-10);
                        return (cleanEmail && hEmail === cleanEmail) || (cleanPhone.length === 10 && hPhone === cleanPhone);
                      });
                      if (duplicateAccount) {
                        showToast('An account or free trial with this Email or Mobile Number already exists. Please Sign In or contact support.', 'error');
                        return;
                      }
                      setCurrentStep('inventory');
                    }}
                    className="inline-flex items-center gap-2 py-2.5 px-6 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-serif font-black text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    <span>Proceed to Inventory</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step Content: 2. ROOM INVENTORY PLANNING */}
            {currentStep === 'inventory' && (
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div className="space-y-1">
                  <span className="text-xs uppercase font-mono text-luxury-gold-300 font-bold">Property Size Scale</span>
                  <h4 className="text-base font-serif font-medium text-white">How many rooms are in your property?</h4>
                  <p className="text-xs text-luxury-brown-200">The system auto-allocates an optimized initial room layout template matching this scale tier constraint.</p>
                </div>

                {/* Room Tiers Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button 
                    type="button"
                    onClick={() => setRoomTier('1-10')}
                    className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all whitespace-normal min-w-0 overflow-hidden ${roomTier === '1-10' ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-white' : 'border-[#8C7355]/20 bg-black/30 hover:border-luxury-gold-500/20'}`}
                  >
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <span className="text-sm font-serif">1 to 10 Rooms</span>
                      {roomTier === '1-10' && <Check className="w-4 h-4 text-luxury-gold-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-luxury-brown-300 leading-relaxed whitespace-normal break-words font-normal">Boutique Guest House scale. Pre-generates 8 calibrated Standard, Deluxe and Executive Suite rooms.</p>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setRoomTier('10-20')}
                    className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all whitespace-normal min-w-0 overflow-hidden ${roomTier === '10-20' ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-white' : 'border-[#8C7355]/20 bg-black/30 hover:border-luxury-gold-500/20'}`}
                  >
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <span className="text-sm font-serif">10 to 20 Rooms</span>
                      {roomTier === '10-20' && <Check className="w-4 h-4 text-luxury-gold-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-luxury-brown-300 leading-relaxed whitespace-normal break-words font-normal">Medium Boutique Hotel scale. Pre-generates 15 rooms split elegantly across high-occupancy classes.</p>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setRoomTier('20-30')}
                    className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all whitespace-normal min-w-0 overflow-hidden ${roomTier === '20-30' ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-white' : 'border-[#8C7355]/20 bg-black/30 hover:border-luxury-gold-500/20'}`}
                  >
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <span className="text-sm font-serif">20 to 30 Rooms</span>
                      {roomTier === '20-30' && <Check className="w-4 h-4 text-luxury-gold-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-luxury-brown-300 leading-relaxed whitespace-normal break-words font-normal">Large Retreat &amp; Lodge scale. Pre-generates 25 fully dynamic inventory items.</p>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setRoomTier('30-50')}
                    className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all whitespace-normal min-w-0 overflow-hidden ${roomTier === '30-50' ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-white' : 'border-[#8C7355]/20 bg-black/30 hover:border-luxury-gold-500/20'}`}
                  >
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <span className="text-sm font-serif">30 to 50 Rooms</span>
                      {roomTier === '30-50' && <Check className="w-4 h-4 text-luxury-gold-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-luxury-brown-300 leading-relaxed whitespace-normal break-words font-normal">Enterprise Resort scale. Pre-generates 40 rooms across standard and luxury suites.</p>
                  </button>
                </div>

                {/* Plan Override option */}
                <div className="bg-black/40 border border-luxury-gold-500/10 p-4 rounded-xl space-y-2 mt-2">
                  <span className="text-[10px] font-mono uppercase text-luxury-gold-400 font-bold">Plan Pricing &amp; Period Choice</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      { key: 'Trial', name: '7-Day Free Trial (₹0)' },
                      { key: 'Monthly', name: 'Monthly Pack (₹1,899)' },
                      { key: 'HalfYearly', name: 'Annual Offer (₹5,999 • 50% OFF)' },
                      { key: 'Yearly', name: 'Premium Pack (₹17,000)' }
                    ].map(pItem => (
                      <button
                        key={pItem.key}
                        type="button"
                        onClick={() => setSelectedPlan(pItem.key as any)}
                        className={`py-2 px-3 rounded-lg border text-left transition-all flex items-center justify-between gap-2 whitespace-normal ${selectedPlan === pItem.key ? 'border-luxury-gold-500 bg-luxury-gold-500/20 font-bold text-white' : 'border-[#8C7355]/10 bg-black/20 text-luxury-brown-200'}`}
                      >
                        <span className="whitespace-normal">{pItem.name}</span>
                        {selectedPlan === pItem.key && <span className="w-1.5 h-1.5 rounded-full bg-luxury-gold-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trial Conditions Notice */}
                <div className="rounded-xl bg-[#160F0A] border border-luxury-gold-500/20 p-3.5 text-[11px] text-[#D8CBB8] space-y-1">
                  <p className="font-bold text-[#E5C687]">
                    {selectedPlan === 'Trial'
                      ? '7-Day Free Trial Conditions (No Credit Card Required):'
                      : `${planDetails.name} Subscription Terms:`}
                  </p>
                  <p>
                    {selectedPlan === 'Trial'
                      ? 'Your 7-day trial activates upon registration with ₹0 upfront payment. At trial expiry, your hotel data, rooms, and guest records are NEVER deleted — you can upgrade seamlessly to a Monthly Pack (₹1,899), Annual Special Offer (₹5,999), or Premium Property Pack (₹17,000).'
                      : `Billed at ₹${planDetails.price.toLocaleString()} + 18% GST (9% CGST + 9% SGST = ₹${totalAmount.toLocaleString()} total) for ${planDetails.period}.`}
                  </p>
                </div>

                {/* Stepper buttons: Do NOT collect payment details when Trial is selected */}
                <div className="pt-4 border-t border-luxury-gold-500/10 flex flex-wrap justify-between items-center gap-3">
                  <button 
                    onClick={() => setCurrentStep('branding')}
                    className="text-xs text-luxury-brown-300 hover:text-white cursor-pointer"
                  >
                    ← Back to Hotel Details
                  </button>
                  {selectedPlan === 'Trial' ? (
                    <button 
                      type="button"
                      onClick={handleOnboardSubmit}
                      disabled={isSubmittingOnboard}
                      className="inline-flex items-center gap-2 py-3 px-4 sm:px-6 bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-black text-xs rounded-xl shadow-lg cursor-pointer disabled:opacity-50 whitespace-normal text-center"
                    >
                      <span>Start 7-Day Free Trial</span>
                      <Sparkles className="w-4 h-4 shrink-0" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        trackSeoConversionEvent('checkout_start', {
                          plan: selectedPlan,
                          roomTier,
                          value: totalAmount
                        });
                        setCurrentStep('payment');
                      }}
                      className="inline-flex items-center gap-2 py-3 px-5 sm:px-6 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-serif font-black text-xs rounded-xl shadow-md cursor-pointer"
                    >
                      <span>Proceed to Billing Checkout</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step Content: 3. BILLING & INVOICE CHECKOUT */}
            {currentStep === 'payment' && (
              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <span className="text-xs uppercase font-mono text-luxury-gold-300 font-bold">Secure SaaS Checkout</span>
                  <h4 className="text-base font-serif font-medium text-white">Consolidated Subscription Invoice</h4>
                  <p className="text-xs text-luxury-brown-200">Review your plan price including legally calculated 18% GST (9% CGST + 9% SGST).</p>
                </div>

                {/* Invoice Receipt Panel */}
                <div className="bg-black/60 border border-[#8C7355]/20 rounded-2xl p-5 space-y-4 font-mono text-xs">
                  <div className="flex justify-between border-b border-luxury-gold-500/10 pb-2.5">
                    <span className="text-luxury-brown-300">Property Client:</span>
                    <span className="text-white font-bold">{hotelName}</span>
                  </div>
                  
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-luxury-brown-300">PMS Module Sub-License:</span>
                      <span className="text-white">Active ({roomTier} Tier)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-luxury-brown-300">Subscription Term:</span>
                      <span className="text-white">{planDetails.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-luxury-brown-300">Base Pack Rate:</span>
                      <span className="text-white">₹{planDetails.price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-luxury-gold-300/90">
                      <span>CGST (9%):</span>
                      <span>₹{cgstAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-luxury-gold-300/90">
                      <span>SGST (9%):</span>
                      <span>₹{sgstAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-luxury-gold-400 font-bold">
                      <span>Total GST (18% — 9% CGST + 9% SGST):</span>
                      <span>₹{gstAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex justify-between border-t border-luxury-gold-500/20 pt-3 text-sm font-bold text-white font-serif">
                    <span className="text-luxury-gold-300">Total Payable Amount:</span>
                    <span>₹{totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Real Direct UPI Payment Portal (QR + Pay via UPI App + UTR Verification) */}
                {selectedPlan === 'Trial' ? (
                  <div className="p-4 bg-luxury-gold-500/5 border border-luxury-gold-500/15 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-luxury-gold-400 font-bold">
                      <ShieldCheck className="w-4 h-4" /> ₹0 — 7-Day Free Trial Activation
                    </div>
                    <p className="text-[11px] text-luxury-brown-200 leading-normal">
                      No UPI or card payment is required. Clicking launch registers your 7-day free trial workspace immediately.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 bg-[#120C08]/90 border border-luxury-gold-500/30 rounded-2xl space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-mono text-luxury-gold-300 font-bold uppercase tracking-wider">
                        <QrCode className="w-4 h-4 text-luxury-gold-400" /> Direct UPI Payment (Verified Billing)
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                        Pay ₹{totalAmount.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                      {/* Live Scannable UPI QR Code */}
                      <div className="sm:col-span-5 flex flex-col items-center">
                        <div className="bg-white p-2.5 rounded-xl shadow-md border-2 border-luxury-gold-500/40">
                          <img
                            src={onboardQrUrl}
                            alt={`DirectStay UPI QR ${onboardUpiId}`}
                            onError={() => {
                              if (onboardQrIdx < onboardQrUrls.length - 1) {
                                setOnboardQrIdx((idx) => idx + 1);
                              }
                            }}
                            className="w-36 h-36 object-contain"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-luxury-brown-300 mt-1.5 text-center">
                          Scan with GPay / PhonePe / Paytm / BHIM
                        </span>
                      </div>

                      {/* Direct UPI ID, Copy & App Deep Link */}
                      <div className="sm:col-span-7 space-y-2.5 text-xs">
                        <div className="bg-black/50 border border-luxury-gold-500/20 rounded-xl p-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-mono uppercase text-luxury-brown-300 block">
                              Official UPI ID ({onboardUpiPayee})
                            </span>
                            <span className="font-mono font-bold text-luxury-gold-300 text-xs sm:text-sm break-all">
                              {onboardUpiId}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyOnboardValue(onboardUpiId, 'upi', 'UPI ID')}
                            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-luxury-gold-500/15 hover:bg-luxury-gold-500/25 border border-luxury-gold-500/35 text-luxury-gold-300 text-[11px] font-bold cursor-pointer"
                          >
                            {onboardCopiedKey === 'upi' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{onboardCopiedKey === 'upi' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <a
                            href={onboardUpiLink}
                            className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Pay ₹{totalAmount.toLocaleString('en-IN')} via UPI App</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyOnboardValue(String(totalAmount), 'amt', 'Payable Amount')}
                            className="inline-flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-luxury-gold-500/25 text-luxury-gold-200 font-mono text-[11px] font-bold cursor-pointer"
                          >
                            {onboardCopiedKey === 'amt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>₹{totalAmount}</span>
                          </button>
                        </div>

                        <a
                          href={buildDirectStayWhatsappUrl({
                            phone: systemWebsite?.whatsappNumber || systemWebsite?.supportPhone || DEFAULT_WHATSAPP_NUMBER,
                            customMessage: `Hello DirectStay Billing, I am onboarding "${hotelName || 'my hotel'}" on ${planDetails.name} (₹${totalAmount} via UPI ${onboardUpiId}).`,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300 hover:underline font-mono"
                        >
                          <ExternalLink className="w-3 h-3" /> Need help? WhatsApp Billing Desk (+91 7978563771)
                        </a>
                      </div>
                    </div>

                    {/* UTR / Transaction Reference Verification Input */}
                    <div className="pt-3 border-t border-luxury-gold-500/15 space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-mono uppercase text-luxury-gold-300 font-bold mb-1">
                          UPI UTR / Transaction Reference Number *
                        </label>
                        <input
                          type="text"
                          value={onboardUtrRef}
                          onChange={(e) => {
                            setOnboardUtrRef(e.target.value);
                            if (onboardUpiError) setOnboardUpiError('');
                          }}
                          placeholder="Enter 12-digit UTR / UPI Ref No. after paying"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-luxury-gold-500/35 text-white font-mono text-xs focus:outline-none focus:border-luxury-gold-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-luxury-brown-300 mb-1">
                          Your Payer UPI ID / Payment Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={onboardPayerUpi}
                          onChange={(e) => setOnboardPayerUpi(e.target.value)}
                          placeholder="e.g. yourname@okaxis or Paid via PhonePe"
                          className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-luxury-gold-500/20 text-white text-xs focus:outline-none focus:border-luxury-gold-400"
                        />
                      </div>
                      {onboardUpiError && (
                        <p className="text-[11px] text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                          {onboardUpiError}
                        </p>
                      )}
                      <p className="text-[10px] text-luxury-brown-300 leading-normal">
                        Your UTR is attached to your tenant onboarding request for instant Super Admin verification &amp; 18% GST Tax Invoice generation.
                      </p>
                    </div>
                  </div>
                )}

                {/* Stepper buttons */}
                <div className="pt-4 border-t border-luxury-gold-500/10 flex flex-wrap justify-between items-center gap-3">
                  <button 
                    onClick={() => setCurrentStep('inventory')}
                    className="text-xs text-luxury-brown-300 hover:text-white cursor-pointer"
                  >
                    ← Back to Room Inventory
                  </button>
                  <button 
                    type="button"
                    onClick={handleOnboardSubmit}
                    disabled={isSubmittingOnboard}
                    className="inline-flex items-center gap-2 py-3.5 px-6 sm:px-8 bg-gradient-to-r from-luxury-gold-500 to-[#8C7355] text-luxury-brown-950 font-serif font-black text-sm rounded-xl shadow-xl shadow-luxury-gold-500/10 hover:scale-102 disabled:opacity-50 cursor-pointer"
                  >
                    <span>{selectedPlan === 'Trial' ? 'Launch 7-Day Free Trial' : 'Submit UTR & Launch Property PMS'}</span>
                    <Sparkles className="w-4 h-4 text-[#120C08]" />
                  </button>
                </div>
              </div>
            )}

            {/* Step Content: 4. PROVISIONING PROCESSING LOADER */}
            {currentStep === 'processing' && (
              <div className="p-10 text-center space-y-6">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-luxury-gold-500/20 animate-pulse" />
                  <div className="absolute inset-0 rounded-full border-4 border-luxury-gold-500 border-t-transparent animate-spin" />
                  <Hotel className="w-6 h-6 text-luxury-gold-400 absolute inset-0 m-auto" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-base font-serif font-bold text-white">Launching Isolated PMS Instance</h4>
                  <p className="text-xs text-luxury-gold-300 font-mono tracking-wide animate-pulse">
                    {onboardStatuses[onboardStatusIndex]}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-luxury-gold-500/10">
                  <div 
                    className="h-full bg-gradient-to-r from-luxury-gold-500 to-[#8C7355] transition-all duration-300"
                    style={{ width: `${((onboardStatusIndex + 1) / onboardStatuses.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* CMS CUSTOM PAGE READER MODAL */}
      {activeCustomPage && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-[#1C140E] border border-luxury-gold-500/30 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden relative">
            <div className="bg-[#120C08] p-6 border-b border-luxury-gold-500/10 flex justify-between items-center">
              <div>
                <span className="text-[9px] font-mono text-luxury-gold-400 uppercase tracking-widest font-black block">
                  {systemWebsite.businessName || 'DirectStay'} • Information Page
                </span>
                <h3 className="font-serif font-bold text-xl text-white">{activeCustomPage.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveCustomPage(null)}
                className="text-luxury-brown-300 hover:text-white px-3 py-1.5 text-xs border border-luxury-brown-100/10 rounded-lg bg-white/5 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {(activeCustomPage.featuredImageUrl || activeCustomPage.imageUrl) && (
                <img
                  src={activeCustomPage.featuredImageUrl || activeCustomPage.imageUrl}
                  alt={activeCustomPage.featuredImageAlt || activeCustomPage.seo?.imageAlt || activeCustomPage.title}
                  className="w-full h-56 object-cover rounded-2xl border border-luxury-gold-500/20"
                />
              )}
              {Array.isArray(activeCustomPage.tags) && activeCustomPage.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activeCustomPage.tags.map((t, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 rounded-full bg-luxury-gold-500/15 border border-luxury-gold-500/30 text-luxury-gold-300 text-[10px] font-mono"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              <div
                className="text-sm text-[#e2d5c5]/85 leading-relaxed font-sans space-y-3 prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(activeCustomPage.content || '') }}
              />
              {activeCustomPage.linkUrl && (
                <div className="pt-2">
                  <a
                    href={activeCustomPage.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-luxury-gold-500 to-[#8C7355] text-luxury-brown-950 font-serif font-bold text-xs rounded-xl"
                  >
                    <span>{activeCustomPage.linkText || 'Learn More'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
