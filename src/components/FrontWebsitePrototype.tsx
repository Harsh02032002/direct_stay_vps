import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Building, Check, ChevronLeft, ChevronRight, ChevronDown, ShieldCheck, CreditCard, Sparkles, 
  Upload, Hotel, LogIn, ArrowRight, Star, HelpCircle, Phone, Mail, 
  MapPin, Globe, CheckCircle, RefreshCw, BarChart3, Users, Landmark,
  Quote, Menu, X, Calendar, BedDouble, Receipt, FileSpreadsheet, BookOpen, Home,
  Search, ArrowLeft, Share2, CheckCircle2, MessageSquare, ExternalLink
} from 'lucide-react';
import { Hotel as HotelType, Room, Staff, HotelPolicy, AuditLog, SystemWebsiteConfig, CustomPage, WebsiteBlogPost } from '../types';
import { INITIAL_SYSTEM_WEBSITE, INITIAL_CUSTOM_PAGES, getPmsData } from '../utils/dummyData';
import { sha256 } from '../utils/crypto';
import { showToast } from '../utils/toast';
import {
  PublicSeoPageKey,
  PUBLIC_SEO_PAGES,
  DIRECTSTAY_DOMAIN,
  SEO_HOTELIER_GUIDES,
  HotelierGuideArticle,
  applySeoHeadTags,
  trackSeoConversionEvent,
  detectLeadSource
} from '../utils/seoManager';

interface MobileSwipeGalleryProps {
  children: React.ReactNode;
  desktopGridClass?: string;
  cardWidthClass?: string;
  label?: string;
}

function MobileSwipeGallery({
  children,
  desktopGridClass = 'md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-5 lg:gap-6',
  cardWidthClass = 'w-[84vw] max-w-[330px] md:w-auto md:max-w-none',
  label = 'Swipe cards →'
}: MobileSwipeGalleryProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const items = React.Children.toArray(children);
  const total = items.length;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || total <= 1) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) {
      setActiveIndex(0);
      return;
    }
    const ratio = el.scrollLeft / maxScroll;
    const idx = Math.min(total - 1, Math.max(0, Math.round(ratio * (total - 1))));
    setActiveIndex(idx);
  };

  const scrollByCard = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.round(el.clientWidth * 0.85);
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.35;
    el.scrollLeft = scrollLeftRef.current - walk;
  };

  const stopDragging = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="w-full">
      {total > 1 && (
        <div className="flex md:hidden items-center justify-between gap-2 mb-2.5 px-1">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-[#E5C687] bg-[#1D140E]/90 border border-[#C9A65B]/35 px-2.5 py-1 rounded-full">
            <span>{label}</span>
            <span className="text-[#C7B9A5]">({activeIndex + 1}/{total})</span>
          </span>
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              aria-label="Previous card"
              className="w-7 h-7 rounded-full bg-[#1D140E] border border-[#C9A65B]/40 text-[#E5C687] flex items-center justify-center active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              aria-label="Next card"
              className="w-7 h-7 rounded-full bg-[#1D140E] border border-[#C9A65B]/40 text-[#E5C687] flex items-center justify-center active:scale-95 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className={`flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-3.5 pb-3 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 md:overflow-visible select-none md:select-auto cursor-grab active:cursor-grabbing md:cursor-auto items-stretch [&::-webkit-scrollbar]:hidden ${desktopGridClass}`}
      >
        {items.map((child, i) => (
          <div
            key={i}
            className={`shrink-0 snap-center h-auto flex flex-col ${cardWidthClass}`}
          >
            {child}
          </div>
        ))}
      </div>

      {total > 1 && (
        <div className="flex md:hidden items-center justify-center gap-1.5 mt-1">
          {items.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to card ${idx + 1}`}
              onClick={() => {
                const el = scrollRef.current;
                if (!el) return;
                const target = (el.scrollWidth - el.clientWidth) * (idx / Math.max(1, total - 1));
                el.scrollTo({ left: target, behavior: 'smooth' });
              }}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeIndex === idx ? 'w-5 bg-[#E5C687]' : 'w-1.5 bg-[#C9A65B]/35'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FrontWebsiteProps {
  onOnboardComplete: (newHotel: HotelType, generatedRooms: Room[]) => Promise<{ success: boolean; error?: string }> | void;
  onNavigateToLogin: () => void;
  systemWebsite?: SystemWebsiteConfig;
  customPages?: CustomPage[];
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

interface AdminGallerySlide {
  id: string;
  stepNumber: string;
  category: 'frontdesk' | 'checkin' | 'billing' | 'finance';
  categoryLabel: string;
  title: string;
  routeBadge: string;
  imageUrl: string;
  description: string;
  highlights: string[];
}

const ADMIN_GALLERY_SLIDES: AdminGallerySlide[] = [
  {
    id: 'step-0-hotel-onboarding',
    stepNumber: '00',
    category: 'frontdesk',
    categoryLabel: 'Hotel Onboarding',
    title: 'Hotel Onboarding: Setup Your New Property, GSTIN & Room Tiers',
    routeBadge: '/onboard-hotel',
    imageUrl: '/gallery/step0-hotel-onboarding.png',
    description:
      'Start your hotel journey in 2 minutes. Filled with real property data: Owner Name (Rajeshwar Singhania), Property Name (Grand Pavilion Resort & Spa), Email (gm@grandpavilion.in), Mobile (+91 79785 63771), City (Puri, Odisha), 15-Digit GSTIN (21AABCG1234F1Z5), Street Address (Marine Drive Road, Golden Beach), and Admin Username (grandpavilion_admin).',
    highlights: [
      'Self-service Hotel Property Onboarding with Owner Name, Property Name, City, Country & 15-Digit GSTIN',
      'Creates isolated multi-tenant workspace with Admin & Hotel Owner login credentials',
      'Automatically provisions Room Categories, 5% GST Billing Engine & Front Desk Console'
    ]
  },
  {
    id: 'step-1-advance-reservation',
    stepNumber: '01A',
    category: 'frontdesk',
    categoryLabel: 'Advance Booking',
    title: 'Create Advance Reservation — Dates, Room, Guest, Source, Tariff, 5% GST & Advance',
    routeBadge: '/admin/reservations',
    imageUrl: '/gallery/step1-advance-reservation.png',
    description:
      'Create connected advance bookings that automatically carry forward to Pre-Arrival, Check-In, In-House Management, Billing, and Checkout. Populated with Guest Siddharth Malhotra (9829054321, Aadhaar 4829-7731-9012), Room 102 Deluxe, Additional Occupants, Booking Source (Direct / Website), Room Tariff ₹3,200, Discount -₹200, 5% GST ₹150, Total ₹3,150, and Advance Payment ₹1,500 via UPI QR (Balance Due ₹1,650).',
    highlights: [
      'Select check-in/out dates & available room (Room 102 Deluxe) with backend overlap validation',
      'Enter guest info, additional occupants, booking source & room tariff (₹3,200) - discount (₹200) + 5% GST (₹150)',
      'Record Advance Payment (₹1,500 via UPI QR) & auto-calculate Net Balance Due (₹1,650)'
    ]
  },
  {
    id: 'step-1b-booking-confirmation',
    stepNumber: '01B',
    category: 'frontdesk',
    categoryLabel: 'Confirmation & Refund',
    title: 'Booking ID Confirmation, Edit, Cancellation & Authorized Refund Workflows',
    routeBadge: '/admin/reservations',
    imageUrl: '/gallery/step1b-booking-confirmation.png',
    description:
      'Every reservation generates a unique Booking ID (#1003 Vikramaditya Rao Room 201 Executive Suite, #1004 Priyanka Mehta Room 301 Presidential Villa, #1006 Karanvir Singh Refunded ₹3,000) with instant confirmation badge, Edit Reservation, and the full Cancellation & Authorized Refund Desk (showing Total Package ₹29,925, Advance Paid ₹15,000, Authorized Refund ₹15,000 via UPI Refund UTR-99887766, and 1-click Confirm & Authorize Refund).',
    highlights: [
      'Generates unique Booking ID (#1003, #1004, #1006) & instant reservation confirmation badge (✓ Confirmed)',
      'Full Cancellation & Authorized Refund Desk: calculates Advance Paid vs. Authorized Refund & Cancellation Fee',
      'Supports UPI / Cash / Bank / Card Refund with UTR Reference (UTR-99887766) or 1-click Edit Reservation Instead'
    ]
  },
  {
    id: 'step-2-pre-arrival',
    stepNumber: '02',
    category: 'frontdesk',
    categoryLabel: 'Pre-Arrival Desk',
    title: 'Pre-Arrival Queue — Today’s & Tomorrow’s Arrivals, ETA, Room Prep & No-Shows',
    routeBadge: '/admin/pre-arrival',
    imageUrl: '/gallery/step2-pre-arrival.png',
    description:
      'Monitor today’s and tomorrow’s arrivals (#1003 Vikramaditya Rao ETA 12:30 PM, #1004 Priyanka Mehta ETA 02:00 PM) from the Pre-Arrival queue. Shows pending confirmations and payments (₹5,000 Paid / ₹12,600 Due), tracks expected arrival time, verifies room preparation (✓ Room Clean & Ready), verifies guest details, and flags no-shows.',
    highlights: [
      'Shows Today’s & Tomorrow’s Arrivals with pending confirmations and advance payment balances',
      'Tracks Expected Arrival Time (ETA), Room Preparation status (✓ Room Clean & Ready) & guest verification',
      'Identifies and processes No-Shows with full booking & audit log history'
    ]
  },
  {
    id: 'step-3-checkin-grc',
    stepNumber: '03',
    category: 'checkin',
    categoryLabel: 'Check-In & GRC',
    title: 'Retrieve Reservation, Verify Guest & Companion ID Proofs, Allocate Room & Check-In',
    routeBadge: '/admin/check-in',
    imageUrl: '/gallery/step3-checkin-grc.png',
    description:
      'Retrieve existing reservation (#1003 Vikramaditya Rao, Room 201 Executive Suite) with all advance booking data carried forward automatically. Verify primary guest Aadhaar (4589-7412-9630, DOB 15-06-1991) + Co-Guest #2 Ananya Rao Aadhaar (6712-8834-1920, DOB 08-11-1994), confirm room allocation, record additional payments, generate GRC registration documents, complete check-in, and update room status to Occupied.',
    highlights: [
      'Retrieves existing reservation (#1003) & carries forward dates, room tariff & ₹5,000 advance automatically',
      'Verifies Primary Guest & Additional Occupant ID proofs (Aadhaar/Passport) & generates GRC registration card',
      'Confirms Room 201 allocation, records check-in payment & updates room status to Occupied'
    ]
  },
  {
    id: 'step-4-inhouse-management',
    stepNumber: '04',
    category: 'checkin',
    categoryLabel: 'In-House Management',
    title: 'In-House Guests — POS/Laundry Charges, Room Change, Stay Extension & Running Folio',
    routeBadge: '/admin/inhouse',
    imageUrl: '/gallery/step4-inhouse-management.png',
    description:
      'Manage active in-house guests (#1001 Aarav Sharma in Room 101 Deluxe, #1002 Neha Verma in Room 103 Executive). Add Restaurant POS food orders (₹966), laundry (₹350), and extra service charges, record mid-stay payments, allow room changes with live availability validation (Shift Room), allow stay extensions (+1 Day) or early departure, and maintain a running guest folio.',
    highlights: [
      'Displays current in-house guest details (#1001 Aarav Sharma Room 101 & #1002 Neha Verma Room 103)',
      'Posts Restaurant POS, Laundry & additional service charges + records mid-stay payments on the running folio',
      'Supports Room Changes with availability validation (Shift Room), Stay Extension (+1 Day) & Early Departure'
    ]
  },
  {
    id: 'step-5-checkout-preparation',
    stepNumber: '05',
    category: 'billing',
    categoryLabel: 'Checkout Preparation',
    title: 'Checkout Preparation — Room & Extra Charges, 5% GST, Advance Deduction & Invoice Preview',
    routeBadge: '/admin/check-out',
    imageUrl: '/gallery/step5-checkout-preparation.png',
    description:
      'Prepare checkout for #1001 Aarav Sharma (Room 101 Deluxe, 3 Nights): calculates Room Charges (₹9,600.00), Extra Service Charges ([LAUNDRY] ₹350.00 + [ROOM SERVICE POS] ₹966.00 = ₹1,316.00), applies Discounts & 5% GST (₹545.80), shows Advance Payments (-₹4,000.00 without duplication), Total Amount Paid (₹4,000.00), Net Outstanding Balance (₹7,461.80), and opens Invoice Preview.',
    highlights: [
      'Calculates Room Charges (3 Nights = ₹9,600), Laundry (₹350), POS Food (₹966) & 5% GST (₹545.80)',
      'Shows Advance Payments (-₹4,000.00) & Total Amount Paid without ever duplicating advance receipts',
      'Displays exact Outstanding Balance (₹7,461.80) & 1-click Preview Final GST Invoice button'
    ]
  },
  {
    id: 'step-6-guest-checkout-invoice',
    stepNumber: '06',
    category: 'billing',
    categoryLabel: 'Guest Checkout & Invoice',
    title: 'Final Bill Review, Split Payments, Refunds, GST Invoice & Room Dirty Trigger',
    routeBadge: '/admin/invoice',
    imageUrl: '/gallery/step6-guest-checkout-invoice.png',
    description:
      'Review final GST Tax Invoice (DSG-INV-BL-BK1001 for Aarav Sharma, Room 101), record Cash, UPI, Card, or Bank payments, support multi-mode Split Payments (₹4,000 UPI + ₹3,461.80 Card), record authorized refunds, and generate the final printable/PDF/WhatsApp invoice. Completing checkout updates booking status to Checked-out and changes room status to Dirty / Cleaning Required.',
    highlights: [
      'Reviews final bill (₹11,461.80 total) & records Cash, UPI, Card, Bank or multi-mode Split Payments',
      'Supports authorized refunds & generates final A4/Thermal GST Invoice (Print / PDF / WhatsApp)',
      'Completes checkout: marks booking Checked-Out & changes Room 101 status to Dirty / Cleaning Required'
    ]
  },
  {
    id: 'step-7-post-checkout-housekeeping',
    stepNumber: '07',
    category: 'checkin',
    categoryLabel: 'Post-Checkout Housekeeping',
    title: 'Auto Housekeeping Task, Cleaning Assignment, Room Inspection & Mark Available',
    routeBadge: '/admin/housekeeping',
    imageUrl: '/gallery/step7-post-checkout-housekeeping.png',
    description:
      'Post-checkout automatically creates a Housekeeping task (Pending Tasks: 2 | Clean Rooms: 6/8) and prevents immediate room re-allocation while cleaning is pending. Assign staff (Sunita Devi — Room 202 Pending, Ramesh Kumar — Room 203 In Progress), perform supervisor room inspection, mark room Available / Clean after inspection (Room 102 Completed & Synced to Room Rack), and save guest history.',
    highlights: [
      'Auto-creates housekeeping task on checkout & blocks room availability until cleaning is completed',
      'Records staff cleaning assignment (Sunita Devi / Ramesh Kumar) & supervisor room inspection checklist',
      'Marks room Available / Clean after inspection (Synced to Room Rack) & archives guest stay history'
    ]
  },
  {
    id: 'step-8-lifecycle-reports',
    stepNumber: '08',
    category: 'finance',
    categoryLabel: 'Lifecycle Reports',
    title: 'Complete Booking-to-Checkout Operational & Financial Reports',
    routeBadge: '/admin/reports',
    imageUrl: '/gallery/step8-lifecycle-reports.png',
    description:
      'Complete Lifecycle Reports suite with all 9 required registers: 1. Advance Reservations, 2. Arrivals and Departures, 3. In-House Guests, 4. No-Shows and Cancellations, 5. Advance Collections, 6. Outstanding Payments, 7. Daily Checkouts, 8. Guest Folios, and 9. Housekeeping Pending—populated with real booking data and 1-click CSV/PDF export.',
    highlights: [
      'Advance Reservations, Arrivals & Departures, In-House Guests, No-Shows & Cancellations',
      'Advance Collections, Outstanding Payments, Daily Checkouts, Guest Folios',
      'Housekeeping Pending queue report + Date-to-Date filter & CSV/Excel/PDF export'
    ]
  },
  {
    id: 'step-9-critical-system-rules',
    stepNumber: '09',
    category: 'frontdesk',
    categoryLabel: 'System Guardrails',
    title: 'System Guardrails — Anti-Overlap Guard, Separate Statuses & Audit Logs',
    routeBadge: '/admin/rooms',
    imageUrl: '/gallery/step9-room-availability-rules.png',
    description:
      'Enforces all 9 Critical System Rules across UI and backend: Never allow overlapping reservations for the same room, Validate availability on backend, Maintain complete booking & payment history, Never duplicate advance payments during checkout, Calculate nights using hotel check-in/out rules, Do not mark room available immediately after checkout if cleaning is pending, Keep booking status and payment status separate, Maintain user activity logs, Enforce property-level access permissions.',
    highlights: [
      'Backend & UI anti-overlap guard: never allows overlapping reservations for the same room',
      'Keeps Booking Status & Payment Status separate + never duplicates advance payments at checkout',
      'Enforces hotel check-in/out night rules, post-checkout cleaning lock, RBAC & immutable activity logs'
    ]
  },
  {
    id: 'step-10-complete-lifecycle-overview',
    stepNumber: '10',
    category: 'finance',
    categoryLabel: 'Dashboard Overview',
    title: 'Complete Connected Flow — Advance Booking → Check-In → Checkout → Room Available',
    routeBadge: '/admin/dashboard',
    imageUrl: '/gallery/step10-complete-lifecycle-overview.png',
    description:
      'Unified command dashboard proving the complete end-to-end tested workflow: Advance Booking → Confirmation → Arrival → Check-In → In-House Charges → Checkout Calculation → Payment → Final Invoice → Housekeeping → Room Available (8 Rooms: 2 Available, 2 Occupied, 2 Booked, 2 Dirty/Cleaning • Total Revenue ₹81,980 • Collected ₹51,825 • Pending Dues ₹31,037).',
    highlights: [
      'Verified flow: Advance Booking → Confirmation → Arrival → Check-In → In-House Charges',
      'Verified settlement: Checkout Calculation → Split Payment → Final Invoice → Housekeeping → Room Available',
      'Reuses existing database tables, APIs & workflows with zero duplicate booking or payment modules'
    ]
  }
];

interface LifecycleReportTabItem {
  id: string;
  number: string;
  title: string;
  badge: string;
  summary: string;
  columns: string[];
  rows: string[][];
}

const LIFECYCLE_REPORTS_DATA: LifecycleReportTabItem[] = [
  {
    id: 'advance',
    number: '8.1',
    title: 'Advance Reservations',
    badge: '3 Active Bookings',
    summary: 'All future & today’s confirmed advance bookings with room allocation, source, tariff, 5% GST, and advance collected.',
    columns: ['Booking ID', 'Guest & Mobile', 'Room & Category', 'Check-In → Check-Out', 'Source', 'Total (5% GST)', 'Advance Paid', 'Status'],
    rows: [
      ['#1003', 'Vikramaditya Rao (+91 98112 23344)', 'Room 201 • Executive Suite', '03 Nov → 06 Nov (3N)', 'Direct / Website', '₹17,600', '₹5,000 (UPI)', 'Confirmed'],
      ['#1004', 'Priyanka Mehta (+91 98223 34455)', 'Room 104 • Deluxe Room', '03 Nov → 05 Nov (2N)', 'MakeMyTrip (OTA)', '₹6,300', '₹2,000 (Card)', 'Confirmed'],
      ['#1005', 'Rohit Singhania (+91 98334 45566)', 'Room 102 • Deluxe Room', '04 Nov → 07 Nov (3N)', 'Corporate Desk', '₹9,450', '₹3,000 (NEFT)', 'Confirmed']
    ]
  },
  {
    id: 'arrivals',
    number: '8.2',
    title: 'Arrivals & Departures',
    badge: '2 Arrivals • 1 Departure',
    summary: 'Today’s & tomorrow’s expected arrivals with ETA, room readiness status, and scheduled departures.',
    columns: ['Type', 'Booking ID', 'Guest Name', 'Room', 'ETA / ETD', 'Room Readiness', 'Balance Due', 'Action Status'],
    rows: [
      ['Today Arrival', '#1003', 'Vikramaditya Rao (+1 Co-Guest)', 'Room 201', 'ETA 12:30 PM', '✓ Clean & Inspected', '₹12,600', 'Ready for Check-In'],
      ['Today Arrival', '#1004', 'Priyanka Mehta', 'Room 104', 'ETA 02:00 PM', '✓ Clean & Inspected', '₹4,300', 'Pre-Arrival Verified'],
      ['Today Departure', '#1001', 'Aarav Sharma (+1 Co-Guest)', 'Room 101', 'ETD 11:00 AM', 'Occupied → Checkout', '₹7,461.80', 'Invoice Preview Ready']
    ]
  },
  {
    id: 'inhouse',
    number: '8.3',
    title: 'In-House Guests',
    badge: '2 Occupied Rooms',
    summary: 'Currently checked-in guests with GRC ID verification, companion count, running POS/Laundry folio, and stay continuation status.',
    columns: ['Booking / GRC', 'Guest & Aadhaar ID', 'Occupants', 'Room', 'Check-In → Check-Out', 'POS & Laundry', 'Running Folio', 'Room Status'],
    rows: [
      ['#1001 (GRC-101)', 'Aarav Sharma • Aadhaar 8421-5920-1143', '2 Adults (Priya Sharma)', 'Room 101 Deluxe', '31 Oct → 03 Nov (3N)', 'POS ₹966 + Laundry ₹350', '₹11,461.80', 'Occupied'],
      ['#1002 (GRC-103)', 'Neha Verma • Aadhaar 7319-4420-8812', '2 Adults', 'Room 103 Executive', '01 Nov → 04 Nov (3N)', 'POS ₹580 + Water ₹60', '₹18,740.00', 'Occupied (Continued 12 PM)']
    ]
  },
  {
    id: 'noshows',
    number: '8.4',
    title: 'No-Shows & Cancellations',
    badge: '2 Logged Records',
    summary: 'Audit register of cancelled reservations and flagged no-shows with advance refund/retention settlement details.',
    columns: ['Booking ID', 'Guest & Mobile', 'Room', 'Original Dates', 'Event Type', 'Advance Collected', 'Refund / Retention', 'Audit By'],
    rows: [
      ['#998', 'Karanbir Kapoor (+91 98700 11223)', 'Room 202 Suite', '01 Nov → 03 Nov', 'Cancelled (Guest Request)', '₹4,000 (UPI)', '₹3,500 Refunded • ₹500 Fee', 'admin (Reception)'],
      ['#999', 'Deepak Chawla (+91 98100 99887)', 'Room 102 Deluxe', '02 Nov → 03 Nov', 'Flagged No-Show (After 6 PM)', '₹1,500 (UPI)', '₹1,500 Retained per Policy', 'admin (Night Audit)']
    ]
  },
  {
    id: 'advances',
    number: '8.5',
    title: 'Advance Collections',
    badge: '₹19,000 Collected',
    summary: 'Itemized advance deposit receipts collected during Advance Reservation and Check-In (never duplicated at Checkout).',
    columns: ['Receipt Ref', 'Booking ID', 'Guest Name', 'Room', 'Collection Stage', 'Payment Mode', 'Amount Collected', 'Carry-Forward Status'],
    rows: [
      ['ADV-RCP-1001', '#1001', 'Aarav Sharma', 'Room 101', 'Advance Booking', 'UPI QR (HDFC)', '₹4,000.00', 'Deducted on Invoice #DSG-INV-BL-BK1001'],
      ['ADV-RCP-1002', '#1002', 'Neha Verma', 'Room 103', 'Check-In Desk', 'Credit Card', '₹5,000.00', 'Active on Running Folio #1002'],
      ['ADV-RCP-1003', '#1003', 'Vikramaditya Rao', 'Room 201', 'Advance Booking', 'UPI QR', '₹5,000.00', 'Carried to Pre-Arrival / Check-In'],
      ['ADV-RCP-1004', '#1004', 'Priyanka Mehta', 'Room 104', 'Advance Booking', 'Debit Card', '₹2,000.00', 'Carried to Pre-Arrival / Check-In'],
      ['ADV-RCP-1005', '#1005', 'Rohit Singhania', 'Room 102', 'Advance Booking', 'Bank NEFT', '₹3,000.00', 'Carried to Future Reservation']
    ]
  },
  {
    id: 'outstanding',
    number: '8.6',
    title: 'Outstanding Payments',
    badge: '₹31,037.80 Pending',
    summary: 'Real-time receivable balance across In-House folios and Pre-Arrival reservations.',
    columns: ['Booking ID', 'Guest Name & Mobile', 'Room', 'Total Bill (Incl. GST)', 'Total Paid So Far', 'Net Outstanding Due', 'Booking Status', 'Payment Status'],
    rows: [
      ['#1001', 'Aarav Sharma (+91 98765 43210)', 'Room 101 Deluxe', '₹11,461.80', '₹4,000.00', '₹7,461.80', 'Checked-In (Checkout Prep)', 'Partial / Due'],
      ['#1002', 'Neha Verma (+91 98123 45678)', 'Room 103 Executive', '₹18,740.00', '₹12,064.00', '₹6,676.00', 'Checked-In (In-House)', 'Partial / Due'],
      ['#1003', 'Vikramaditya Rao (+91 98112 23344)', 'Room 201 Suite', '₹17,600.00', '₹5,000.00', '₹12,600.00', 'Confirmed (Arriving Today)', 'Advance Paid'],
      ['#1004', 'Priyanka Mehta (+91 98223 34455)', 'Room 104 Deluxe', '₹6,300.00', '₹2,000.00', '₹4,300.00', 'Confirmed (Arriving Today)', 'Advance Paid']
    ]
  },
  {
    id: 'checkouts',
    number: '8.7',
    title: 'Daily Checkouts',
    badge: '2 Completed Today',
    summary: 'Register of completed guest checkouts with final GST invoice numbers, split payment modes, and post-checkout room status.',
    columns: ['Invoice No.', 'Booking ID', 'Guest Name', 'Room', 'Nights', 'Final Bill (5% GST)', 'Settlement Breakdown', 'Post-Checkout Room Status'],
    rows: [
      ['DSG-INV-BL-BK1001', '#1001', 'Aarav Sharma', 'Room 101', '3 Nights', '₹11,461.80', '₹4,000 Adv + ₹4,000 UPI + ₹3,461.80 Card', 'Dirty / Cleaning Required → HK Queue'],
      ['DSG-INV-BL-BK1000', '#1000', 'devendra Singhania', 'Room 102', '2 Nights', '₹6,720.00', '₹2,000 Adv + ₹4,720 Cash', 'Inspected → Available / Clean']
    ]
  },
  {
    id: 'folios',
    number: '8.8',
    title: 'Guest Folios',
    badge: 'Itemized Ledger',
    summary: 'Complete itemized Guest Folio showing Room Tariff, POS orders, Laundry, Discount, 2.5% CGST + 2.5% SGST, Advance Paid, and Final Settlement.',
    columns: ['Folio Line Item', 'Date & Time', 'Reference', 'Category', 'Base Amount', 'GST (5%)', 'Line Total', 'Settlement Status'],
    rows: [
      ['Room 101 Deluxe Tariff (3 Nights × ₹3,200)', '31 Oct – 03 Nov', 'BK-1001-RM', 'Room Rent', '₹9,600.00', '₹480.00 (2.5%+2.5%)', '₹10,080.00', 'Posted to Folio'],
      ['Restaurant POS Order #POS-401 (Paneer Tikka, Naan, Dal)', '01 Nov • 08:45 PM', 'KOT-401', 'POS Room Service', '₹920.00', '₹46.00 (5% Food GST)', '₹966.00', 'Synced to Room 101'],
      ['Express Guest Laundry (4 Garments Steam Press)', '02 Nov • 10:15 AM', 'LND-209', 'Laundry Service', '₹350.00', '₹19.80', '₹369.80', 'Synced to Room 101'],
      ['Less: Advance Deposit Collected at Booking', '30 Oct • 11:20 AM', 'ADV-RCP-1001', 'Advance Receipt', '-₹4,000.00', '—', '-₹4,000.00', 'Carried Forward (No Duplication)'],
      ['Final Checkout Split Settlement (UPI + Visa Card)', '03 Nov • 10:55 AM', 'DSG-INV-BL-BK1001', 'Final Settlement', '₹7,461.80', 'Incl.', '₹0.00 Balance Due', 'Settled & Checked-Out ✓']
    ]
  },
  {
    id: 'housekeeping',
    number: '8.9',
    title: 'Housekeeping Pending',
    badge: '2 Pending • 1 Completed',
    summary: 'Live Post-Checkout Housekeeping turnaround queue enforcing room inspection before marking any room Available / Clean.',
    columns: ['Task ID', 'Room & Category', 'Trigger Source', 'Assigned Staff', 'Cleaning Instructions', 'Cleaning Status', 'Supervisor Inspection', 'Front Desk Rack Status'],
    rows: [
      ['HK-TSK-301', 'Room 202 • Executive Suite', 'Post-Checkout Auto-Trigger', 'Sunita Devi', 'Full linen change, sanitize minibar & bath', 'Pending', 'Awaiting Inspection', 'Blocked (Dirty / Cleaning Required)'],
      ['HK-TSK-302', 'Room 203 • Presidential Suite', 'Post-Checkout Auto-Trigger', 'Ramesh Kumar', 'Deep vacuum, replenish welcome tray & towels', 'In Progress', 'Inspection In Progress', 'Blocked (Cleaning In Progress)'],
      ['HK-TSK-300', 'Room 102 • Deluxe Room', 'Post-Checkout (#1000)', 'Sunita Devi', 'Standard checkout turnaround & UV sanitize', 'Completed ✓', 'Verified by Supervisor ✓', 'Available / Clean (Synced to Rack)']
    ]
  }
];

const CRITICAL_SYSTEM_RULES_DATA = [
  {
    num: 'Rule 01',
    title: 'Never Allow Overlapping Reservations',
    desc: 'Strict date-range conflict engine blocks double-booking the same room across Advance Reservations, Walk-In Check-Ins, Room Shifts, and Stay Extensions.'
  },
  {
    num: 'Rule 02',
    title: 'Backend Availability Validation',
    desc: 'Every room allocation and reservation write is validated on the backend API against active bookings, occupied check-ins, and uncleaned rooms.'
  },
  {
    num: 'Rule 03',
    title: 'Complete Booking & Payment History',
    desc: 'Maintains a unified chronological ledger from Advance Deposit → Mid-Stay Folio Receipt → Split Checkout Settlement → Refund Voucher.'
  },
  {
    num: 'Rule 04',
    title: 'Zero Advance Payment Duplication',
    desc: 'Advance deposits collected at reservation are tagged as carried-forward credits and automatically deducted once during Checkout Calculation.'
  },
  {
    num: 'Rule 05',
    title: 'Hotel Check-In / Check-Out Night Rules',
    desc: 'Calculates stay nights using the property’s configured 12:00 PM Check-In / 11:00 AM Check-Out schedule with automated 12:00 PM stay continuation prompts.'
  },
  {
    num: 'Rule 06',
    title: 'Mandatory Post-Checkout Cleaning Lock',
    desc: 'Checkout automatically switches the room to Dirty / Cleaning Required and blocks re-allocation until Housekeeping completes cleaning & inspection.'
  },
  {
    num: 'Rule 07',
    title: 'Separate Booking & Payment Statuses',
    desc: 'Tracks Booking Lifecycle Status (Confirmed / Checked-In / Checked-Out / Cancelled / No-Show) independently from Payment Status (Paid / Partial / Due / Refunded).'
  },
  {
    num: 'Rule 08',
    title: 'Immutable User Activity Audit Logs',
    desc: 'Every reservation, GRC upload, room shift, discount, invoice generation, and housekeeping sign-off is logged with staff username, role, and timestamp.'
  },
  {
    num: 'Rule 09',
    title: 'Property-Level Access Permissions (RBAC)',
    desc: 'Enforces strict multi-tenant hotelId isolation and granular role permissions across Owner, Admin, Manager, Receptionist, Accountant, and Housekeeping.'
  }
];

const DEFAULT_LEGAL_PAGES: Record<string, CustomPage> = {
  privacy: {
    id: 'legal-privacy-policy',
    title: 'Privacy Policy & Guest Data Protection',
    slug: 'privacy-policy',
    published: true,
    createdAt: '',
    content: `DirectStay PMS (https://directstay.online)

1. Overview & Commitment to Hospitality Privacy
DirectStay PMS ("we", "our", or "us") provides cloud-based Hotel Property Management Software to independent hotels, resorts, and boutique properties. We are committed to protecting the privacy of hotel owners, staff members, and their guests in accordance with applicable Indian data protection laws (including the Digital Personal Data Protection Act and IT Act).

2. Information Collected by Hotel Tenants
When a hotel uses DirectStay PMS, the property collects and manages operational data including:
• Hotel Identity: Property name, address, GSTIN, owner/admin contact numbers, and email addresses.
• Guest Registration Records (GRC): Guest names, phone numbers, check-in/check-out dates, room allocations, and statutory Government ID proofs (Aadhaar, Passport, Voter ID, Driving License) required under local Police Sarai compliance regulations.
• Billing & Financial Ledgers: Room tariffs, POS food orders, GST tax invoices, and payment mode references (Cash, UPI, Card, Bank Transfer).

3. Strict Multi-Tenant Data Isolation
Every onboarded hotel operates within an isolated tenant workspace. Your guest registry, financial ledgers, room rates, and invoices are strictly private to your property and are never shared with, sold to, or accessible by other hotels or third-party marketers.

4. How We Use Information
We process platform data solely to:
• Deliver real-time front-desk, reservation, POS, housekeeping, and GST billing services.
• Generate guest invoices and allow hotel staff to share bills via WhatsApp or print.
• Provide onboarding assistance, technical support, and system security audit logs.

5. Data Security & Retention
All passwords are encrypted using SHA-256 cryptographic hashing, and API transmissions occur over HTTPS/TLS encryption. Hotel owners retain full ownership of their property data and may export their ledgers (CSV/PDF) or request account deletion at any time by contacting raghunathpanigrahi4@gmail.com or +91 79785 63771.`
  },
  terms: {
    id: 'legal-terms-of-service',
    title: 'Terms & Conditions of SaaS Service',
    slug: 'terms-of-service',
    published: true,
    createdAt: '',
    content: `DirectStay PMS (https://directstay.online)

1. Acceptance of Terms
By registering for a 7-Day Free Trial or subscribing to a paid plan on DirectStay PMS, the hotel property ("Tenant", "You") agrees to abide by these Terms & Conditions.

2. 7-Day Free Trial & SaaS Subscriptions
• 7-Day Free Trial: New properties receive 7 days of full-feature access at ₹0 with no credit card required.
• Paid Subscription Plans: After or during the trial, properties may select the Monthly Pack (₹1,899/month + 5% GST), Annual Special Offer (₹5,999/year + 5% GST), or Premium Property Pack (₹17,000/year + 5% GST).
• Zero Commission Policy: DirectStay charges a flat SaaS subscription fee and takes 0% commission on your hotel room bookings or POS sales.

3. Account Approval & Authorized Use
• Newly registered tenant accounts undergo a standard Super Admin verification check to ensure authentic hotel onboarding.
• You are responsible for maintaining the confidentiality of your Admin, Hotel Owner, Receptionist, Accountant, and Housekeeping login credentials.

4. GST Invoicing & Statutory Compliance
DirectStay PMS provides configurable GST billing tools (including 2.5% CGST + 2.5% SGST = 5% GST slabs and B2B GSTIN fields) and digital Guest Registration Cards (GRC). The hotel management remains responsible for verifying guest ID documents and filing statutory tax returns according to local regulations.

5. Platform Availability & Support
We strive to maintain 99.9% cloud uptime along with dedicated WhatsApp, phone (+91 79785 63771), and email onboarding support.`
  },
  refund: {
    id: 'legal-refund-policy',
    title: 'Refund & Cancellation Policy',
    slug: 'refund-policy',
    published: true,
    createdAt: '',
    content: `DirectStay PMS (https://directstay.online)

1. Risk-Free 7-Day Free Trial First
We strongly encourage every hotel owner and manager to start with our 7-Day Free Trial (₹0, no credit card required). This allows your reception and accounting teams to thoroughly test Room Management, Walk-In Check-Ins, GST Invoicing, POS, and Reports before making any subscription payment.

2. Subscription Cancellation
• You may cancel your Monthly or Annual DirectStay PMS subscription at any time from your Hotel Owner Console or by contacting our support desk.
• Upon cancellation, your property workspace will remain active until the end of the current paid billing cycle, and no automatic recurring charges will be made.
• Before your subscription expires, you can export all your guest records, GST invoices, and financial ledgers in CSV/PDF format.

3. Refund Eligibility
• Duplicate or Accidental Charges: If a hotel is accidentally charged twice for the same subscription invoice via UPI/Card/NetBanking, 100% of the duplicate payment will be refunded within 5–7 business days.
• Initial 7-Day Satisfaction Window on Annual Plans: If you purchase an Annual plan directly and experience a critical technical issue that our engineering support team is unable to resolve within 7 days of activation, you may request a pro-rata refund.

4. How to Request Billing Support
For any subscription invoice, plan upgrade, or refund query, contact our Direct Desk at raghunathpanigrahi4@gmail.com or call/WhatsApp +91 79785 63771 with your Hotel Name and Invoice Reference.`
  },
  security: {
    id: 'legal-data-security',
    title: 'Data Security, Multi-Tenant Isolation & RBAC',
    slug: 'security',
    published: true,
    createdAt: '',
    content: `DirectStay Cloud Security Architecture

1. Multi-Tenant Database Isolation
Every hotel property onboarded onto DirectStay PMS is assigned a unique cryptographic Hotel ID. All database queries, room inventories, guest folios, and financial vouchers are strictly scoped and validated against your active session token and tenant ID.

2. Role-Based Access Control (RBAC)
DirectStay separates operational duties from financial ownership:
• Hotel Owner Portal (/hotelowner): Full read visibility into daily revenue, occupancy, staff performance, subscription status, and tamper-evident audit logs.
• Hotel Admin & Reception (/admin): Day-to-day Front Desk check-ins, room rack, POS billing, housekeeping, and voucher entry.
• Granular Staff Permissions: Restrict unauthorized bill deletions, retrospective tariff edits, or unapproved expense payouts.

3. Immutable Security Audit Logs
Every login attempt, room status change, invoice generation, payment entry, and expense approval is recorded with a timestamp and user identity in the Audit Trail.`
  }
};

export default function FrontWebsite({
  onOnboardComplete,
  onNavigateToLogin,
  systemWebsite = INITIAL_SYSTEM_WEBSITE,
  customPages = [],
  activeSeoPage = 'home',
  activeBlogSlug,
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('onboard') || params.has('step') || params.has('setup')) {
        setShowWizard(true);
        const st = params.get('step');
        if (st === 'inventory' || st === '2') setCurrentStep('inventory');
        else if (st === 'payment' || st === '3') setCurrentStep('payment');
        else setCurrentStep('branding');
      }
    }
  }, [activeSeoPage]);

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
  const [demoSliderIndex, setDemoSliderIndex] = useState(0);
  const [isDemoSliderAutoPlay, setIsDemoSliderAutoPlay] = useState(true);
  const [galleryCategoryFilter, setGalleryCategoryFilter] = useState<'all' | 'frontdesk' | 'checkin' | 'billing' | 'finance'>('all');
  const [lightboxSlideIndex, setLightboxSlideIndex] = useState<number | null>(null);
  const [activeLifecycleReportId, setActiveLifecycleReportId] = useState<string>('advance');

  const activeLifecycleReport =
    LIFECYCLE_REPORTS_DATA.find((r) => r.id === activeLifecycleReportId) || LIFECYCLE_REPORTS_DATA[0];
  const isMainSixSectionPage = ['home', 'features', 'pricing', 'about', 'contact'].includes(activeSeoPage);

  React.useEffect(() => {
    if (!isDemoSliderAutoPlay || lightboxSlideIndex !== null) return;
    const timer = setInterval(() => {
      setDemoSliderIndex((prev) => (prev + 1) % ADMIN_GALLERY_SLIDES.length);
    }, 4800);
    return () => clearInterval(timer);
  }, [isDemoSliderAutoPlay, lightboxSlideIndex]);

  const activeDemoSlide = ADMIN_GALLERY_SLIDES[demoSliderIndex] || ADMIN_GALLERY_SLIDES[0];
  const filteredGallerySlides =
    galleryCategoryFilter === 'all'
      ? ADMIN_GALLERY_SLIDES
      : ADMIN_GALLERY_SLIDES.filter((s) => s.category === galleryCategoryFilter);

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
  const publishedCustomPages = effectiveCustomPages.filter((p) => p.published);

  const navigateSeo = (pageKey: PublicSeoPageKey, sectionId?: string, blogSlug?: string) => {
    setMobileMenuOpen(false);
    if (pageKey === 'blog-article' && blogSlug) {
      const match = publishedBlogs.find((b) => b.slug === blogSlug);
      if (match) setActiveBlogArticle(match);
    } else if (pageKey === 'blog') {
      setActiveBlogArticle(null);
    }
    if (onNavigateSeoPage) {
      onNavigateSeoPage(pageKey, blogSlug);
    } else if (typeof window !== 'undefined') {
      const targetPath = (pageKey === 'blog-article' && blogSlug) ? `/blog/${blogSlug}/` : (PUBLIC_SEO_PAGES[pageKey]?.path || '/');
      window.history.pushState({}, '', targetPath);
    }
    const autoSectionMap: Partial<Record<PublicSeoPageKey, string>> = {
      features: 'features',
      pricing: 'pricing',
      about: 'about',
      contact: 'contact'
    };
    const targetSecId = sectionId || autoSectionMap[pageKey];
    if (typeof window !== 'undefined') {
      if (pageKey === 'home' && !sectionId) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (targetSecId) {
        setTimeout(() => {
          const el = document.getElementById(targetSecId);
          if (el) {
            const navHeight = 68;
            const elementTop = el.getBoundingClientRect().top + window.scrollY - navHeight;
            window.scrollTo({ top: Math.max(0, elementTop), behavior: 'smooth' });
          }
        }, 70);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
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
      supportPhone: systemWebsite?.supportPhone || '+91-7978563771',
      supportEmail: systemWebsite?.supportEmail || 'raghunathpanigrahi4@gmail.com',
      contactAddress: systemWebsite?.contactAddress || 'Puri & Bhubaneswar, Odisha, India',
      logoUrl: systemWebsite?.logoUrl || '',
      blogPost: (activeSeoPage === 'blog-article' && activeBlogArticle) ? activeBlogArticle : undefined
    });
    const sectionMap: Partial<Record<PublicSeoPageKey, string>> = {
      features: 'features',
      pricing: 'pricing',
      about: 'about',
      contact: 'contact'
    };
    const secId = sectionMap[activeSeoPage];
    if (secId && typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        const el = document.getElementById(secId);
        if (el) {
          const navHeight = 68;
          const elementTop = el.getBoundingClientRect().top + window.scrollY - navHeight;
          window.scrollTo({ top: Math.max(0, elementTop), behavior: 'smooth' });
        }
      }, 90);
      return () => clearTimeout(timer);
    }
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
  }, [activeSeoPage, systemWebsite]);

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
  const hasLegacyPricingCards =
    Array.isArray(systemWebsite.pricingCards) &&
    systemWebsite.pricingCards.some(
      (c) =>
        String(c?.priceText || '').includes('7,999') ||
        String(c?.priceText || '').includes('14,000') ||
        String(c?.title || '').includes('6 Month') ||
        String(c?.gstText || '').includes('18% GST')
    );
  const pricingCards =
    Array.isArray(systemWebsite.pricingCards) &&
    systemWebsite.pricingCards.length > 0 &&
    !hasLegacyPricingCards
      ? systemWebsite.pricingCards
      : INITIAL_SYSTEM_WEBSITE.pricingCards || [];
  const visionPillars =
    Array.isArray(systemWebsite.visionPillars) && systemWebsite.visionPillars.length > 0
      ? systemWebsite.visionPillars
      : INITIAL_SYSTEM_WEBSITE.visionPillars || [];
  const customSections = Array.isArray(systemWebsite.customSections)
    ? systemWebsite.customSections
    : [];
  const publishedBlogs: WebsiteBlogPost[] = (
    Array.isArray(systemWebsite.blogs) && systemWebsite.blogs.length > 0
      ? systemWebsite.blogs
      : INITIAL_SYSTEM_WEBSITE.blogs || []
  ).filter((b) => b.published !== false);
  const [activeBlogArticle, setActiveBlogArticle] = useState<WebsiteBlogPost | null>(() => {
    if (activeBlogSlug) {
      const allB = (Array.isArray(systemWebsite.blogs) && systemWebsite.blogs.length > 0 ? systemWebsite.blogs : INITIAL_SYSTEM_WEBSITE.blogs || []);
      const found = allB.find((b) => b.slug === activeBlogSlug);
      if (found) return found;
    }
    return null;
  });
  const [blogSearchQuery, setBlogSearchQuery] = useState('');
  const [blogCategoryFilter, setBlogCategoryFilter] = useState('All');
  const [copiedBlogLink, setCopiedBlogLink] = useState(false);

  useEffect(() => {
    if (activeSeoPage === 'blog-article') {
      if (activeBlogSlug) {
        const found = publishedBlogs.find((b) => b.slug === activeBlogSlug);
        if (found) setActiveBlogArticle(found);
        else if (publishedBlogs.length > 0) setActiveBlogArticle(publishedBlogs[0]);
      } else if (!activeBlogArticle && publishedBlogs.length > 0) {
        setActiveBlogArticle(publishedBlogs[0]);
      }
    } else if (activeSeoPage === 'blog') {
      setActiveBlogArticle(null);
    }
  }, [activeSeoPage, activeBlogSlug, publishedBlogs]);

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
      status: 'Pending'
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
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden overflow-x-clip bg-[#0E0906] text-[#e2d5c5] selection:bg-luxury-gold-300 selection:text-luxury-brown-950 pb-20 lg:pb-0">
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

          {/* CENTER: SEO Navigation Links (Desktop Only — Home, Features, Pricing, About, Contact) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center justify-center gap-7 text-[13.5px] font-medium text-[#EFE6DA] lg:absolute lg:left-1/2 lg:-translate-x-1/2"
          >
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigateSeo('home', 'hero');
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
                navigateSeo('features', 'features');
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
                navigateSeo('pricing', 'pricing');
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
                navigateSeo('about', 'about');
              }}
              className={`hover:text-[#E5C687] transition-colors whitespace-nowrap cursor-pointer ${
                activeSeoPage === 'about' ? 'text-[#E5C687] font-bold' : ''
              }`}
            >
              About
            </a>
            {publishedBlogs.length > 0 && (
              <a
                href="/blog/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateSeo('blog');
                }}
                className={`hover:text-[#E5C687] transition-colors whitespace-nowrap cursor-pointer ${
                  activeSeoPage === 'blog' || activeSeoPage === 'blog-article' ? 'text-[#E5C687] font-bold' : ''
                }`}
              >
                Blog
              </a>
            )}
            <a
              href="/contact/"
              onClick={(e) => {
                e.preventDefault();
                navigateSeo('contact', 'contact');
              }}
              className={`hover:text-[#E5C687] transition-colors whitespace-nowrap cursor-pointer ${
                activeSeoPage === 'contact' ? 'text-[#E5C687] font-bold' : ''
              }`}
            >
              Contact
            </a>
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
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR (Home, Features, Pricing, About, Contact) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0F0906]/95 backdrop-blur-xl border-t border-[#C5A059]/35 shadow-[0_-8px_30px_rgba(0,0,0,0.75)] px-2 py-1.5"
      >
        <div className="grid grid-cols-5 gap-1">
          {[
            { key: 'home' as PublicSeoPageKey, sec: 'hero', label: 'Home', icon: Home },
            { key: 'features' as PublicSeoPageKey, sec: 'features', label: 'Features', icon: Building },
            { key: 'pricing' as PublicSeoPageKey, sec: 'pricing', label: 'Pricing', icon: CreditCard },
            { key: 'about' as PublicSeoPageKey, sec: 'about', label: 'About', icon: ShieldCheck },
            { key: 'contact' as PublicSeoPageKey, sec: 'contact', label: 'Contact', icon: Phone }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeSeoPage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigateSeo(item.key, item.sec)}
                className={`relative flex-1 min-w-0 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-b from-[#2A1D12] to-[#1A120B] text-[#E5C687] border border-[#C5A059]/50 shadow-sm'
                    : 'text-[#C8B9A6] hover:text-[#FAF6F0]'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-[#E5C687]" />
                )}
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#E5C687]' : 'text-[#A89882]'}`} />
                <span className="text-[9px] font-mono font-semibold tracking-tight truncate">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* DEDICATED INNER SEO PAGE HERO + BREADCRUMBS (Only on standalone inner routes like /gallery/, /hotel-reservation-software/, /hotel-billing-software/, /free-trial/, or legal pages) */}
      {!isMainSixSectionPage && activeSeoPage !== 'blog-article' && (
        <section className="pt-24 pb-12 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#17100B] via-[#120C08] to-[#0E0906] border-b border-[#C5A059]/25">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-[#C8B9A6]">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateSeo('home', 'hero');
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
                  onClick={() => setShowDemoModal(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#E2C280] via-[#D2AC64] to-[#B88E44] hover:from-[#EAD092] hover:to-[#C69C52] text-[#140C07] font-serif font-bold text-xs sm:text-sm px-5 sm:px-6 py-3 rounded-xl shadow-lg cursor-pointer"
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>Book a Free Demo</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateSeo('home', 'hero')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1D140E] hover:bg-[#281C14] border border-[#C5A059]/50 text-[#FAF6F0] font-serif font-bold text-xs sm:text-sm px-5 sm:px-6 py-3 rounded-xl cursor-pointer"
                >
                  <span>← Back to Home Page</span>
                </button>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleStartOnboard('Trial')}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-serif font-bold text-[#E5C687] hover:text-[#FAF6F0] underline underline-offset-4 cursor-pointer"
                >
                  <Hotel className="w-4 h-4 text-[#D4AF6A] shrink-0" />
                  <span>Want to onboard your hotel? Click here to Register &amp; Onboard Your Property →</span>
                </button>
              </div>
            </div>

            {/* Specialized Product Module Breakdown for /hotel-reservation-software/, /hotel-billing-software/, /free-trial/, /about/ */}
            {activeSeoPage === 'hotel-reservation-software' && (
              <div className="pt-6 border-t border-[#C5A059]/15">
                <MobileSwipeGallery desktopGridClass="md:grid md:grid-cols-3 md:gap-5" label="Swipe Reservation Modules →">
                  <div className="h-full rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                    <h2 className="text-base font-serif font-bold text-[#E5C687]">
                      Real-Time Room Availability Calendar
                    </h2>
                    <p className="text-xs text-[#D5C7B4] leading-relaxed">
                      View date-wise room occupancy across Standard, Deluxe, Executive, and Suite categories. Prevent double bookings and assign rooms instantaneously.
                    </p>
                  </div>
                  <div className="h-full rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                    <h2 className="text-base font-serif font-bold text-[#E5C687]">
                      Advance Bookings &amp; Walk-In Check-Ins
                    </h2>
                    <p className="text-xs text-[#D5C7B4] leading-relaxed">
                      Record advance reservation deposits, capture Aadhaar/Passport ID proofs (GRC), manage companion guests, and convert reservations to active stays in one click.
                    </p>
                  </div>
                  <div className="h-full rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                    <h2 className="text-base font-serif font-bold text-[#E5C687]">
                      Flexible Occupancy &amp; Extra Guest Rules
                    </h2>
                    <p className="text-xs text-[#D5C7B4] leading-relaxed">
                      Configure Base Occupancy, Max Occupancy, Extra Person Charges, and Optional Hotel Services per room so tariffs calculate accurately every time.
                    </p>
                  </div>
                </MobileSwipeGallery>
              </div>
            )}

            {activeSeoPage === 'hotel-billing-software' && (
              <div className="pt-6 border-t border-[#C5A059]/15">
                <MobileSwipeGallery desktopGridClass="md:grid md:grid-cols-3 md:gap-5" label="Swipe Billing Modules →">
                  <div className="h-full rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                    <h2 className="text-base font-serif font-bold text-[#E5C687]">
                      GST-Compliant Hotel Tax Invoicing
                    </h2>
                    <p className="text-xs text-[#D5C7B4] leading-relaxed">
                      Generate accurate CGST &amp; SGST hotel bills with B2B customer GSTIN support, customizable invoice conditions, and instant A4 print or PDF download.
                    </p>
                  </div>
                  <div className="h-full rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                    <h2 className="text-base font-serif font-bold text-[#E5C687]">
                      Unified Guest Stay Folio &amp; POS Sync
                    </h2>
                    <p className="text-xs text-[#D5C7B4] leading-relaxed">
                      Automatically consolidate room rent, extra bed, extra person charges, restaurant POS food orders, laundry, and water/room services onto a single check-out bill.
                    </p>
                  </div>
                  <div className="h-full rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                    <h2 className="text-base font-serif font-bold text-[#E5C687]">
                      Advance Deposits, Split Settlements &amp; Ledgers
                    </h2>
                    <p className="text-xs text-[#D5C7B4] leading-relaxed">
                      Track advance collections, apply check-out discounts or bill adjustments, settle via Cash, UPI, Card, or Bank Transfer, and sync directly with daily cash handovers.
                    </p>
                  </div>
                </MobileSwipeGallery>
              </div>
            )}

            {activeSeoPage === 'free-trial' && (
              <div className="pt-6 border-t border-[#C5A059]/15">
                <MobileSwipeGallery desktopGridClass="md:grid md:grid-cols-3 md:gap-5" label="Swipe Trial Steps →">
                  <div className="h-full rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                    <h2 className="text-base font-serif font-bold text-[#E5C687]">
                      1. Register Your Property in 2 Minutes
                    </h2>
                    <p className="text-xs text-[#D5C7B4] leading-relaxed">
                      Click &ldquo;Start 7-Day Free Trial&rdquo;, enter your hotel name, contact phone, and desired admin username. No credit card or upfront payment is required.
                    </p>
                  </div>
                  <div className="h-full rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                    <h2 className="text-base font-serif font-bold text-[#E5C687]">
                      2. Explore All Hotel PMS Modules Free
                    </h2>
                    <p className="text-xs text-[#D5C7B4] leading-relaxed">
                      Test reservations, walk-in check-ins, room management, housekeeping, POS billing, GST invoices, and financial reports with your own team for 7 full days.
                    </p>
                  </div>
                  <div className="h-full rounded-2xl bg-[#18110B] border border-[#C5A059]/25 p-5 space-y-2">
                    <h2 className="text-base font-serif font-bold text-[#E5C687]">
                      3. Choose a Plan Only When Ready
                    </h2>
                    <p className="text-xs text-[#D5C7B4] leading-relaxed">
                      Upgrade seamlessly to our Monthly Pack (₹1,899/month), Annual Pack – Special Offer (₹5,999/year, 50% OFF), or Premium Property Pack (₹17,000/year) while keeping all your configured rooms and data intact.
                    </p>
                  </div>
                </MobileSwipeGallery>
              </div>
            )}
          </div>
        </section>
      )}

      {/* DEDICATED LEGAL & COMPLIANCE PAGES (/privacy-policy/, /terms-and-conditions/, /refund-policy/, /data-security/) */}
      {(activeSeoPage === 'privacy-policy' ||
        activeSeoPage === 'terms-and-conditions' ||
        activeSeoPage === 'refund-policy' ||
        activeSeoPage === 'data-security') && (
        <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#0E0906] via-[#130C08] to-[#0B0705] border-b border-[#C9A65B]/20">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Quick Legal Page Switcher Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: 'privacy-policy', label: 'Privacy Policy' },
                  { key: 'terms-and-conditions', label: 'Terms & Conditions' },
                  { key: 'refund-policy', label: 'Refund & Cancellation Policy' },
                  { key: 'data-security', label: 'Data Security & Isolation' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => navigateToSeoRoute(tab.key as PublicSeoPageKey)}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-serif font-bold border transition-all cursor-pointer ${
                      activeSeoPage === tab.key
                        ? 'bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] border-[#FAF6F0]/40 shadow-md'
                        : 'bg-[#18110B] text-[#D8CBB8] border-[#C9A65B]/25 hover:border-[#E5C687]/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigateToSeoRoute('home')}
                className="px-4 py-2 rounded-xl bg-[#241911] hover:bg-[#2F2016] text-[#E5C687] border border-[#C9A65B]/35 text-xs font-mono font-bold cursor-pointer"
              >
                ← Back to Home Page
              </button>
            </div>

            {/* Legal Document Card */}
            {(() => {
              const doc =
                activeSeoPage === 'privacy-policy'
                  ? DEFAULT_LEGAL_PAGES.privacy
                  : activeSeoPage === 'terms-and-conditions'
                  ? DEFAULT_LEGAL_PAGES.terms
                  : activeSeoPage === 'refund-policy'
                  ? DEFAULT_LEGAL_PAGES.refund
                  : DEFAULT_LEGAL_PAGES.security;
              return (
                <div className="rounded-3xl bg-gradient-to-b from-[#1B120C]/95 via-[#140D09] to-[#0E0906] border border-[#C9A65B]/35 p-6 sm:p-9 lg:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] space-y-6">
                  <div className="border-b border-[#C9A65B]/20 pb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] font-bold block">
                        DirectStay PMS • Official Legal &amp; Compliance Policy
                      </span>
                      <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif font-bold text-[#FAF6F0] mt-1">
                        {doc.title}
                      </h2>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[11px] font-mono font-bold">
                      Verified &amp; Active
                    </span>
                  </div>

                  <div className="text-sm sm:text-base text-[#EAE0D3]/90 leading-relaxed whitespace-pre-line font-sans space-y-4">
                    {doc.content}
                  </div>

                  <div className="pt-6 border-t border-[#C9A65B]/20 flex flex-wrap items-center justify-between gap-4">
                    <div className="text-xs text-[#B7A691] font-mono">
                      Questions regarding compliance or hotel data privacy? Email{' '}
                      <a href={`mailto:${systemWebsite.supportEmail}`} className="text-[#E5C687] underline">
                        {systemWebsite.supportEmail}
                      </a>{' '}
                      or call <span className="text-[#E5C687] font-bold">{formattedSupportPhone}</span>.
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStartOnboard('Trial')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-black text-xs cursor-pointer shadow-md"
                    >
                      <span>Start Your 7-Day Free Trial</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* DEDICATED /BLOG/ DIRECTORY PAGE */}
      {activeSeoPage === 'blog' && (
        <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#0E0906] via-[#130C08] to-[#0B0705] border-b border-[#C9A65B]/20">
          <div className="max-w-7xl mx-auto space-y-10">
            {/* Search and Category Filter Toolbar */}
            <div className="rounded-2xl bg-[#160F0A] border border-[#C9A65B]/35 p-4 sm:p-6 space-y-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative w-full md:w-96">
                  <Search className="w-4 h-4 text-[#A89882] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={blogSearchQuery}
                    onChange={(e) => setBlogSearchQuery(e.target.value)}
                    placeholder="Search hospitality guides, GST billing..."
                    className="w-full pl-10 pr-12 py-2.5 rounded-xl bg-[#0E0906] border border-[#C9A65B]/30 text-sm text-[#FAF6F0] placeholder-[#8A7968] focus:outline-none focus:border-[#E5C687]"
                  />
                  {blogSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBlogSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#A89882] hover:text-white cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {['All', 'Front Desk & Operations', 'GST Billing & Finance', 'Direct Bookings & Growth'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setBlogCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                        blogCategoryFilter === cat
                          ? 'bg-gradient-to-r from-[#E5C687] to-[#C89D52] text-[#120C08] border-[#FAF6F0]/50 shadow-md'
                          : 'bg-[#221710] text-[#D8CBB8] border-[#C9A65B]/25 hover:border-[#E5C687]/60'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Blog Articles Grid */}
            {(() => {
              const filtered = publishedBlogs.filter((b) => {
                const matchesCat = blogCategoryFilter === 'All' || b.category === blogCategoryFilter;
                const matchesQ =
                  !blogSearchQuery.trim() ||
                  b.title.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                  (b.summary && b.summary.toLowerCase().includes(blogSearchQuery.toLowerCase())) ||
                  (b.content && b.content.toLowerCase().includes(blogSearchQuery.toLowerCase()));
                return matchesCat && matchesQ;
              });

              if (filtered.length === 0) {
                return (
                  <div className="rounded-2xl bg-[#140D08] border border-[#C9A65B]/25 p-12 text-center space-y-4">
                    <p className="text-[#C7B9A5] text-base font-serif">No hospitality guides found matching "{blogSearchQuery}".</p>
                    <button
                      type="button"
                      onClick={() => {
                        setBlogSearchQuery('');
                        setBlogCategoryFilter('All');
                      }}
                      className="px-4 py-2 rounded-xl bg-[#241911] text-[#E5C687] border border-[#C9A65B]/40 text-xs font-mono font-bold cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  {filtered.map((blog) => (
                    <article
                      key={blog.id}
                      className="group h-full rounded-2xl bg-gradient-to-b from-[#1B130C]/95 to-[#110B07]/95 border border-[#C9A65B]/25 hover:border-[#DFBD78]/65 overflow-hidden flex flex-col justify-between shadow-[0_14px_35px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300"
                    >
                      <div>
                        <div className="relative h-48 overflow-hidden bg-[#140D08]">
                          <img
                            src={blog.imageUrl}
                            alt={blog.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute top-3 left-3">
                            <span className="px-3 py-1 rounded-full bg-[#120C08]/90 border border-[#C9A65B]/45 text-[#E5C687] text-[10px] font-mono uppercase tracking-wider font-bold">
                              {blog.category}
                            </span>
                          </div>
                        </div>

                        <div className="p-6 space-y-3">
                          <div className="flex items-center justify-between text-[11px] font-mono text-[#A89882]">
                            <span>{blog.publishedAt}</span>
                            <span>{blog.readTime || '4 min read'}</span>
                          </div>
                          <h3 className="text-lg font-serif font-bold text-[#FAF6F0] group-hover:text-[#E5C687] transition-colors leading-snug line-clamp-2">
                            <a
                              href={`/blog/${blog.slug}/`}
                              onClick={(e) => {
                                e.preventDefault();
                                navigateSeo('blog-article', undefined, blog.slug);
                              }}
                            >
                              {blog.title}
                            </a>
                          </h3>
                          <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed line-clamp-3">
                            {blog.summary || (blog as any).excerpt}
                          </p>
                        </div>
                      </div>

                      <div className="px-6 pb-5 pt-3 border-t border-[#C9A65B]/15 flex items-center justify-between text-xs">
                        <span className="font-mono text-[11px] text-[#9E8D78]">
                          By <strong className="text-[#E6DBD0]">{blog.author}</strong>
                        </span>
                        <a
                          href={`/blog/${blog.slug}/`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigateSeo('blog-article', undefined, blog.slug);
                          }}
                          className="font-serif font-bold text-[#E5C687] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Read Full Guide</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              );
            })()}

            {/* Trial CTA Box */}
            <div className="rounded-3xl bg-gradient-to-r from-[#1E130B] via-[#2A1B10] to-[#1E130B] border border-[#C9A65B]/35 p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-left">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] font-bold">
                  Zero Commission • 7-Day Free Trial
                </span>
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF6F0]">
                  Ready to Automate Your Hotel Operations?
                </h3>
                <p className="text-xs sm:text-sm text-[#C7B9A5] max-w-xl">
                  Configure your hotel rooms, test fast check-ins with digital Aadhaar GRC cards, and generate 5% GST invoices with zero risk.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleStartOnboard('Trial')}
                className="shrink-0 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-bold text-sm cursor-pointer shadow-lg hover:brightness-110 transition-all inline-flex items-center gap-2"
              >
                <span>Start 7-Day Free Trial</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* DEDICATED /BLOG/:SLUG/ ARTICLE READER PAGE */}
      {activeSeoPage === 'blog-article' && (() => {
        const article =
          (activeBlogArticle && activeBlogArticle.slug === activeBlogSlug ? activeBlogArticle : null) ||
          publishedBlogs.find((b) => b.slug === activeBlogSlug) ||
          activeBlogArticle ||
          publishedBlogs[0];

        if (!article) return null;

        const currentArticleUrl = typeof window !== 'undefined' ? `${DIRECTSTAY_DOMAIN}/blog/${article.slug}/` : `https://directstay.online/blog/${article.slug}/`;
        const relatedArticles = publishedBlogs.filter((b) => b.slug !== article.slug).slice(0, 2);

        const handleCopyArticleLink = () => {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(currentArticleUrl);
            setCopiedBlogLink(true);
            setTimeout(() => setCopiedBlogLink(false), 2500);
          }
        };

        const handleShareWhatsApp = () => {
          if (typeof window !== 'undefined') {
            const shareText = encodeURIComponent(`${article.title}\n\nRead more at: ${currentArticleUrl}`);
            window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
          }
        };

        const handleShareTwitter = () => {
          if (typeof window !== 'undefined') {
            const shareText = encodeURIComponent(`${article.title} via @DirectStay`);
            window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(currentArticleUrl)}`, '_blank');
          }
        };

        return (
          <article className="pt-24 pb-16 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#140D08] via-[#0E0906] to-[#080503] border-b border-[#C9A65B]/20">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Breadcrumb Navigation */}
              <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-[#C8B9A6] flex-wrap">
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
                <a
                  href="/blog/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateSeo('blog');
                  }}
                  className="hover:text-[#E5C687] transition-colors"
                >
                  Blog
                </a>
                <span>/</span>
                <span className="text-[#E5C687] font-semibold truncate max-w-xs sm:max-w-md" aria-current="page">
                  {article.title}
                </span>
              </nav>

              {/* Article Header */}
              <header className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-3.5 py-1 rounded-full bg-[#241911] border border-[#C9A65B]/45 text-[#E5C687] text-[11px] font-mono uppercase tracking-wider font-bold">
                    {article.category}
                  </span>
                  <span className="text-xs font-mono text-[#A89882]">
                    Published {article.publishedAt}
                  </span>
                  <span className="text-xs font-mono text-[#A89882]">•</span>
                  <span className="text-xs font-mono text-[#A89882]">
                    {article.readTime || '4 min read'}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#FAF6F0] tracking-tight leading-[1.2]">
                  {article.title}
                </h1>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#C9A65B]/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E5C687] to-[#B88E42] text-[#120C08] font-bold font-serif flex items-center justify-center text-sm shadow-md">
                      {article.author.charAt(0)}
                    </div>
                    <div>
                      <span className="text-xs font-mono text-[#9E8D78] block">Written by</span>
                      <strong className="text-sm font-serif text-[#FAF6F0]">{article.author}</strong>
                    </div>
                  </div>

                  {/* Social Share Buttons Bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#A89882] hidden sm:inline">Share:</span>
                    <button
                      type="button"
                      onClick={handleCopyArticleLink}
                      className="px-3 py-1.5 rounded-lg bg-[#1D140E] hover:bg-[#281C14] border border-[#C9A65B]/30 text-xs font-mono text-[#E5C687] transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      {copiedBlogLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                      <span>{copiedBlogLink ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="p-2 rounded-lg bg-[#1D140E] hover:bg-[#25D366]/20 border border-[#C9A65B]/30 text-[#25D366] transition-all cursor-pointer"
                      title="Share on WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleShareTwitter}
                      className="p-2 rounded-lg bg-[#1D140E] hover:bg-sky-500/20 border border-[#C9A65B]/30 text-[#FAF6F0] transition-all cursor-pointer"
                      title="Share on Twitter / X"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </header>

              {/* Featured Hero Image */}
              <div className="relative rounded-3xl overflow-hidden border-2 border-[#C9A65B]/35 shadow-2xl bg-[#140D08] max-h-[460px]">
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Lead Summary Callout */}
              <div className="rounded-2xl bg-[#1A120B] border-l-4 border-[#E5C687] p-5 sm:p-6 shadow-md">
                <p className="text-sm sm:text-base font-serif italic text-[#E5C687] leading-relaxed">
                  "{article.summary || (article as any).excerpt}"
                </p>
              </div>

              {/* Full Article Body */}
              <div className="prose prose-invert max-w-none text-[#E8DCCF] text-base sm:text-lg leading-relaxed space-y-6 whitespace-pre-line font-sans border-b border-[#C9A65B]/20 pb-10">
                {article.content}
              </div>

              {/* Bottom Share Bar and Back Navigation */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => navigateSeo('blog')}
                  className="px-4 py-2.5 rounded-xl bg-[#1D140E] hover:bg-[#281C14] border border-[#C9A65B]/40 text-[#E5C687] font-mono text-xs font-bold cursor-pointer inline-flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to All Articles</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyArticleLink}
                    className="px-4 py-2 rounded-xl bg-[#241911] hover:bg-[#2F2016] border border-[#C9A65B]/40 text-[#E5C687] text-xs font-mono font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedBlogLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedBlogLink ? 'Link Copied' : 'Share Link'}</span>
                  </button>
                </div>
              </div>

              {/* Related Articles Section */}
              {relatedArticles.length > 0 && (
                <div className="pt-8 border-t border-[#C9A65B]/20 space-y-6">
                  <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF6F0]">
                    Related Hospitality &amp; Hotel Guides
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {relatedArticles.map((rel) => (
                      <div
                        key={rel.id}
                        className="rounded-2xl bg-[#150E0A] border border-[#C9A65B]/25 p-5 space-y-3 hover:border-[#E5C687]/60 transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#E5C687] font-bold">
                            {rel.category}
                          </span>
                          <h4 className="text-base font-serif font-bold text-[#FAF6F0] line-clamp-2">
                            <a
                              href={`/blog/${rel.slug}/`}
                              onClick={(e) => {
                                e.preventDefault();
                                navigateSeo('blog-article', undefined, rel.slug);
                              }}
                              className="hover:text-[#E5C687] transition-colors"
                            >
                              {rel.title}
                            </a>
                          </h4>
                          <p className="text-xs text-[#B7A691] line-clamp-2">
                            {rel.summary}
                          </p>
                        </div>
                        <a
                          href={`/blog/${rel.slug}/`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigateSeo('blog-article', undefined, rel.slug);
                          }}
                          className="text-xs font-serif font-bold text-[#E5C687] inline-flex items-center gap-1 cursor-pointer pt-2 hover:underline"
                        >
                          <span>Read Guide</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Free Trial Banner */}
              <div className="rounded-3xl bg-gradient-to-r from-[#20140B] via-[#2F1E11] to-[#20140B] border border-[#C9A65B]/40 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
                <div className="space-y-1.5">
                  <h4 className="text-lg sm:text-xl font-serif font-bold text-[#FAF6F0]">
                    Experience DirectStay PMS Risk-Free
                  </h4>
                  <p className="text-xs text-[#D8CBB8]">
                    Start your 7-day full feature trial today. No credit card required.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleStartOnboard('Trial')}
                  className="shrink-0 px-6 py-3 rounded-xl bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-bold text-xs cursor-pointer shadow-md hover:brightness-110"
                >
                  Start 7-Day Free Trial →
                </button>
              </div>
            </div>
          </article>
        );
      })()}

      {/* DEDICATED /GALLERY PAGE: ADMIN PANEL SCREENSHOTS & INTERACTIVE PRODUCT DEMO TOUR */}
      {activeSeoPage === 'gallery' && (
        <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#0E0906] via-[#130C08] to-[#0B0705] border-b border-[#C9A65B]/20">
          <div className="max-w-7xl mx-auto space-y-12">
            {/* WORKFLOW QUICK-JUMP BAR */}
            <div className="rounded-2xl bg-[#160F0A] border border-[#C9A65B]/35 p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#E5C687] font-bold">
                  DirectStay PMS • Interactive Product Walkthrough
                </span>
                <span className="text-[11px] font-mono text-emerald-300">
                  Advance Booking → Confirmation → Arrival → Check-In → In-House → Checkout → Invoice → Housekeeping → Room Available
                </span>
              </div>
              <div
                style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                className="flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
              >
                {ADMIN_GALLERY_SLIDES.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setDemoSliderIndex(idx);
                      setIsDemoSliderAutoPlay(false);
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                      demoSliderIndex === idx
                        ? 'bg-gradient-to-r from-[#E5C687] to-[#C89D52] text-[#120C08] border-[#FAF6F0]/50 shadow-md'
                        : 'bg-[#221710] text-[#E6DBD0] border-[#C9A65B]/30 hover:border-[#E5C687]/60'
                    }`}
                  >
                    {s.categoryLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* TOP INTERACTIVE DEMO SLIDER */}
            <div className="rounded-3xl bg-gradient-to-b from-[#1D140E] via-[#140D09] to-[#0D0805] border border-[#C9A65B]/40 p-4 sm:p-7 lg:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.65)] space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C9A65B]/20 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-full bg-[#E5C687]/15 border border-[#E5C687]/45 text-[#E5C687] text-[10px] font-mono uppercase tracking-widest font-bold">
                    {activeDemoSlide.categoryLabel}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDemoSliderAutoPlay((p) => !p)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                      isDemoSliderAutoPlay
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-[#241911] text-[#D8CBB8] border-[#C9A65B]/30'
                    }`}
                  >
                    {isDemoSliderAutoPlay ? '● Auto-Slide ON' : '○ Auto-Slide Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDemoSliderIndex(
                        (prev) => (prev - 1 + ADMIN_GALLERY_SLIDES.length) % ADMIN_GALLERY_SLIDES.length
                      )
                    }
                    aria-label="Previous admin screen"
                    className="w-8 h-8 rounded-xl bg-[#241911] hover:bg-[#312217] border border-[#C9A65B]/40 text-[#E5C687] flex items-center justify-center cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDemoSliderIndex((prev) => (prev + 1) % ADMIN_GALLERY_SLIDES.length)
                    }
                    aria-label="Next admin screen"
                    className="w-8 h-8 rounded-xl bg-[#241911] hover:bg-[#312217] border border-[#C9A65B]/40 text-[#E5C687] flex items-center justify-center cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Screenshot Frame */}
                <div className="lg:col-span-8">
                  <div
                    onClick={() => setLightboxSlideIndex(demoSliderIndex)}
                    className="group relative rounded-2xl overflow-hidden border-2 border-[#C9A65B]/40 bg-[#080503] shadow-2xl cursor-zoom-in"
                  >
                    <div className="bg-[#160F0A] px-3.5 py-2 border-b border-[#C9A65B]/25 flex items-center justify-between text-[11px] font-mono text-[#C8B9A6]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                        <span className="ml-2 text-[#E5C687] font-bold truncate">
                          https://directstay.online{activeDemoSlide.routeBadge}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#E5C687] group-hover:underline">
                        🔍 Click to Full-Screen Zoom
                      </span>
                    </div>
                    <img
                      src={activeDemoSlide.imageUrl}
                      alt={activeDemoSlide.title}
                      className="w-full h-auto max-h-[460px] object-cover object-top transition-transform duration-500 group-hover:scale-[1.01]"
                    />
                  </div>
                </div>

                {/* Slide Explanation & Highlights */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#241911] border border-[#C9A65B]/35 text-[#E5C687] text-[10px] font-mono uppercase tracking-wider font-bold">
                    <span>{activeDemoSlide.categoryLabel}</span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF6F0] leading-snug">
                    {activeDemoSlide.title}
                  </h2>

                  <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                    {activeDemoSlide.description}
                  </p>

                  <ul className="space-y-2 text-xs text-[#E6DBD0] pt-1">
                    {activeDemoSlide.highlights.map((hl, hIdx) => (
                      <li key={hIdx} className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-[#C5A059]/20 border border-[#C5A059]/50 flex items-center justify-center text-[#E5C687] shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                        </span>
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-3 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setLightboxSlideIndex(demoSliderIndex)}
                      className="px-4 py-2.5 rounded-xl bg-[#241911] hover:bg-[#312217] border border-[#C9A65B]/45 text-[#E5C687] text-xs font-mono font-bold cursor-pointer"
                    >
                      🔍 Full-Screen Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmedDemoBooking(null);
                        setShowDemoModal(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-black text-xs cursor-pointer"
                    >
                      Book a Free Demo →
                    </button>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleStartOnboard('Trial')}
                      className="text-xs font-mono text-[#E5C687] hover:text-[#FAF6F0] underline underline-offset-4 cursor-pointer"
                    >
                      Want to onboard your hotel? Register &amp; Onboard Property →
                    </button>
                  </div>
                </div>
              </div>

              {/* Thumbnail Strip Selector */}
              <div
                style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                className="flex items-center gap-2.5 overflow-x-auto pt-3 border-t border-[#C9A65B]/20 [&::-webkit-scrollbar]:hidden"
              >
                {ADMIN_GALLERY_SLIDES.map((slide, sIdx) => {
                  const isCurrent = sIdx === demoSliderIndex;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => {
                        setDemoSliderIndex(sIdx);
                        setIsDemoSliderAutoPlay(false);
                      }}
                      className={`shrink-0 w-36 sm:w-44 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[#2A1D13] border-[#E5C687] shadow-md'
                          : 'bg-[#140D09] border-[#C9A65B]/25 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={slide.imageUrl}
                        alt={slide.title}
                        className="w-full h-16 object-cover object-top rounded-lg border border-[#C9A65B]/20 mb-1.5"
                      />
                      <div className="text-[10px] font-mono text-[#E5C687] font-bold truncate">
                        {slide.categoryLabel}
                      </div>
                      <div className="text-[11px] font-serif text-[#FAF6F0] truncate">
                        {slide.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CATEGORY FILTER & ALL 12 ADMIN SCREENSHOT CARDS */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] font-bold block">
                    DirectStay PMS Visual Directory
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#FAF6F0] mt-1">
                    All DirectStay PMS Product Screens
                  </h2>
                </div>

                {/* Filter Pills */}
                <div
                  style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  className="flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
                >
                  {[
                    { id: 'all', label: `All Screens (${ADMIN_GALLERY_SLIDES.length})` },
                    { id: 'frontdesk', label: 'Front Desk & Rooms' },
                    { id: 'checkin', label: 'Check-In & Housekeeping' },
                    { id: 'billing', label: 'GST Billing & POS' },
                    { id: 'finance', label: 'Finance & Reports' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setGalleryCategoryFilter(cat.id as any)}
                      className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                        galleryCategoryFilter === cat.id
                          ? 'bg-gradient-to-r from-[#E5C687] to-[#C89D52] text-[#120C08] border-[#FAF6F0]/40'
                          : 'bg-[#18110B] text-[#D8CBB8] border-[#C9A65B]/25 hover:border-[#E5C687]/60'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <MobileSwipeGallery
                desktopGridClass="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 items-stretch"
                label="Swipe Product Screenshots →"
              >
                {filteredGallerySlides.map((slide) => {
                  const fullIdx = ADMIN_GALLERY_SLIDES.findIndex((s) => s.id === slide.id);
                  return (
                    <div
                      key={slide.id}
                      className="group h-full rounded-2xl bg-gradient-to-b from-[#1B130C] to-[#110B07] border border-[#C9A65B]/30 hover:border-[#E5C687]/70 overflow-hidden flex flex-col justify-between shadow-[0_14px_35px_rgba(0,0,0,0.5)] transition-all"
                    >
                      <div>
                        <div
                          onClick={() => setLightboxSlideIndex(fullIdx >= 0 ? fullIdx : 0)}
                          className="relative overflow-hidden border-b border-[#C9A65B]/25 bg-black cursor-zoom-in"
                        >
                          <img
                            src={slide.imageUrl}
                            alt={slide.title}
                            className="w-full h-48 sm:h-52 object-cover object-top group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-[#C9A65B]/40 text-[10px] font-mono text-[#E5C687] font-bold">
                            {slide.categoryLabel}
                          </div>
                          <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-[#E5C687]/40 text-[10px] font-mono text-white">
                            🔍 Tap to Zoom
                          </div>
                        </div>

                        <div className="p-5 space-y-2.5">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4AF6A] font-bold block">
                            {slide.categoryLabel}
                          </span>
                          <h3 className="text-base sm:text-lg font-serif font-bold text-[#FAF6F0] leading-snug">
                            {slide.title}
                          </h3>
                          <p className="text-xs text-[#C7B9A5] leading-relaxed">
                            {slide.description}
                          </p>
                        </div>
                      </div>

                      <div className="px-5 pb-5 pt-3 border-t border-[#C9A65B]/15 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setLightboxSlideIndex(fullIdx >= 0 ? fullIdx : 0)}
                          className="text-xs font-mono font-bold text-[#E5C687] hover:underline cursor-pointer"
                        >
                          Open Full Screen →
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDemoSliderIndex(fullIdx >= 0 ? fullIdx : 0);
                            window.scrollTo({ top: 180, behavior: 'smooth' });
                          }}
                          className="text-[11px] font-mono text-[#B7A691] hover:text-white cursor-pointer"
                        >
                          Load in Tour Slider
                        </button>
                      </div>
                    </div>
                  );
                })}
              </MobileSwipeGallery>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 1 OF 6 (HOMEPAGE HERO): NAVBAR + CINEMATIC RESORT HERO + 4-PILLAR BAR IN 1 VIEWPORT */}
      {isMainSixSectionPage && (
        <div
          id="hero"
          className="relative w-full lg:h-screen lg:min-h-[600px] lg:max-h-[960px] pt-16 flex flex-col justify-between overflow-hidden border-b border-[#C5A059]/20"
        >
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

              {/* Primary CTA (Book a Free Demo) & Secondary CTA (Explore Product Demo) */}
              <div className="w-full max-w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedDemoBooking(null);
                    setShowDemoModal(true);
                  }}
                  className="w-full sm:w-auto max-w-full inline-flex items-center justify-center gap-2 sm:gap-2.5 bg-gradient-to-r from-[#E2C280] via-[#D2AC64] to-[#B88E44] hover:from-[#EAD092] hover:to-[#C69C52] text-[#140C07] font-serif font-bold text-[13px] sm:text-[13.5px] lg:text-[14.5px] px-4 sm:px-6 py-3 rounded-xl shadow-[0_10px_28px_rgba(0,0,0,0.45)] border border-[#F5DFA3]/40 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DFBD78]"
                >
                  <Calendar className="w-4 h-4 stroke-[2.2] shrink-0" />
                  <span>Book a Free Demo</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateToSeoRoute('gallery')}
                  className="w-full sm:w-auto max-w-full inline-flex items-center justify-center gap-2 sm:gap-2.5 bg-[#150E09]/85 hover:bg-[#22170F]/95 border border-[#C5A059]/50 hover:border-[#DFBD78]/85 text-[#FAF6F0] font-serif font-bold text-[13px] sm:text-[13.5px] lg:text-[14.5px] px-4 sm:px-6 py-3 rounded-xl backdrop-blur-md shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DFBD78]"
                >
                  <span>Explore Product Demo</span>
                  <ArrowRight className="w-4 h-4 text-[#DFBD78] shrink-0" />
                </button>
              </div>

              {/* Hotel Onboarding Link Below (Neeche) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleStartOnboard('Trial')}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-serif font-bold text-[#E5C687] hover:text-[#FAF6F0] underline underline-offset-4 cursor-pointer transition-colors"
                >
                  <Hotel className="w-4 h-4 text-[#DFBD78] shrink-0" />
                  <span>Want to onboard your hotel? Click here to Register &amp; Onboard Your Property →</span>
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

          {/* 4-COLUMN BOTTOM FEATURE STRIP (Swipeable Gallery on Mobile) */}
          <div className="relative z-10 shrink-0 bg-gradient-to-t from-[#0A0604]/95 via-[#0E0906]/75 to-transparent pt-2 pb-4 lg:py-4">
            <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
              <MobileSwipeGallery
                desktopGridClass="md:grid md:grid-cols-2 lg:grid-cols-4 md:divide-x divide-[#C5A059]/25"
                cardWidthClass="w-[78vw] max-w-[280px] md:w-auto md:max-w-none"
                label="Swipe Highlights →"
              >
                {heroBottomPillars.map((pillar, idx) => (
                  <div
                    key={pillar.id || idx}
                    className="h-full px-4 lg:px-5 py-3.5 md:py-1 rounded-2xl md:rounded-none bg-[#160F0A]/90 md:bg-transparent border border-[#C5A059]/30 md:border-0 flex flex-col items-center text-center group"
                  >
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
              </MobileSwipeGallery>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2 OF 6 ON MAIN PAGE: CORE FEATURES — H2: Everything You Need to Manage Your Hotel */}
      {isMainSixSectionPage && (
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

          {/* Features Cards Gallery (Swipeable on Mobile, 3-Col Grid on Desktop) */}
          <MobileSwipeGallery
            desktopGridClass="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-5 lg:gap-6 items-stretch"
            label="Swipe Feature Cards →"
          >
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
          </MobileSwipeGallery>

          {/* Feature Section Product Module Internal Links Bar */}
          <div className="mt-8 pt-6 border-t border-[#C9A65B]/15 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#140D09]/80 border border-[#C9A65B]/20 rounded-2xl p-5">
            <div className="space-y-1 text-center sm:text-left">
              <p className="text-sm font-serif font-semibold text-[#FAF6F0]">
                Explore Dedicated Hotel PMS Modules or Open the Interactive Product Walkthrough
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs font-mono text-[#D4AF6A]">
                <a
                  href="/gallery/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSeoRoute('gallery');
                  }}
                  className="text-[#E5C687] font-bold hover:text-[#FAF6F0] underline underline-offset-4"
                >
                  ★ Interactive Product Walkthrough
                </a>
                <span>•</span>
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
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => navigateToSeoRoute('gallery')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-black text-xs tracking-wide shadow-md cursor-pointer"
              >
                <span>Open Full Product Demo</span>
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
      )}

      {/* SECTION 3 ON MAIN PAGE: INTERACTIVE PRODUCT DEMO SLIDER */}
      {isMainSixSectionPage && (
        <section
          id="demo-slider"
          className="relative py-12 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-10 bg-[#0B0705] border-b border-[#C9A65B]/20 overflow-hidden"
        >
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="max-w-4xl mx-auto text-center space-y-2.5">
              <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/35 px-3.5 py-1 rounded-full font-bold">
                Interactive Product Walkthrough • Booking-to-Checkout Lifecycle
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-[#FAF6F0] tracking-tight leading-[1.15]">
                Connected Hotel Onboarding → Advance Booking → Check-In → Checkout Demo
              </h2>
              <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed">
                Every field entered during <strong className="text-[#E5C687]">Hotel Onboarding &amp; Advance Reservation</strong> automatically carries forward to <strong className="text-[#E5C687]">Pre-Arrival, Check-In &amp; GRC, In-House Folio, Checkout Preparation, Split-Payment GST Invoice, Housekeeping Turnaround, and Reports</strong>. Click any screen below to open the full product walkthrough.
              </p>
            </div>

            {/* Interactive Picture Slider Box */}
            <div className="rounded-3xl bg-gradient-to-b from-[#1D140E] via-[#140D09] to-[#0D0805] border border-[#C9A65B]/40 p-4 sm:p-6 lg:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.65)] space-y-6">
              {/* Workflow Quick-Jump Bar */}
              <div
                style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#C9A65B]/15 [&::-webkit-scrollbar]:hidden"
              >
                {ADMIN_GALLERY_SLIDES.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setDemoSliderIndex(idx);
                      setIsDemoSliderAutoPlay(false);
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                      demoSliderIndex === idx
                        ? 'bg-gradient-to-r from-[#E5C687] to-[#C89D52] text-[#120C08] border-[#FAF6F0]/50 shadow-md'
                        : 'bg-[#221710] text-[#E6DBD0] border-[#C9A65B]/30 hover:border-[#E5C687]/60'
                    }`}
                  >
                    {s.categoryLabel}
                  </button>
                ))}
              </div>

              {/* Top Slider Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C9A65B]/20 pb-3.5">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-[#E5C687]/15 border border-[#E5C687]/40 text-[#E5C687] text-[10px] font-mono uppercase tracking-widest font-bold">
                    {activeDemoSlide.categoryLabel}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDemoSliderAutoPlay((p) => !p)}
                    className={`px-3 py-1 rounded-xl text-[10.5px] font-mono font-bold border transition-all cursor-pointer ${
                      isDemoSliderAutoPlay
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-[#241911] text-[#D8CBB8] border-[#C9A65B]/30'
                    }`}
                  >
                    {isDemoSliderAutoPlay ? '● Auto-Demo ON' : '○ Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDemoSliderIndex(
                        (prev) => (prev - 1 + ADMIN_GALLERY_SLIDES.length) % ADMIN_GALLERY_SLIDES.length
                      )
                    }
                    aria-label="Previous slide"
                    className="w-8 h-8 rounded-xl bg-[#241911] hover:bg-[#312217] border border-[#C9A65B]/40 text-[#E5C687] flex items-center justify-center cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDemoSliderIndex((prev) => (prev + 1) % ADMIN_GALLERY_SLIDES.length)
                    }
                    aria-label="Next slide"
                    className="w-8 h-8 rounded-xl bg-[#241911] hover:bg-[#312217] border border-[#C9A65B]/40 text-[#E5C687] flex items-center justify-center cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main Slide Picture + Explanation */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-7">
                  <div
                    onClick={() => navigateToSeoRoute('gallery')}
                    className="group relative rounded-2xl overflow-hidden border-2 border-[#C9A65B]/40 hover:border-[#E5C687] bg-[#080503] shadow-2xl cursor-pointer"
                  >
                    <div className="bg-[#160F0A] px-3.5 py-2 border-b border-[#C9A65B]/25 flex items-center justify-between text-[11px] font-mono text-[#C8B9A6]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 shrink-0" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 shrink-0" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shrink-0" />
                        <span className="ml-2 text-[#E5C687] font-bold truncate">
                          DirectStay PMS • {activeDemoSlide.categoryLabel}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#E5C687] font-bold shrink-0 group-hover:underline">
                        ↗ Click to Open Full Product Demo
                      </span>
                    </div>
                    <img
                      src={activeDemoSlide.imageUrl}
                      alt={activeDemoSlide.title}
                      className="w-full h-auto max-h-[410px] object-cover object-top transition-transform duration-500 group-hover:scale-[1.01]"
                    />
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-4">
                  <span className="inline-block text-[10px] font-mono uppercase tracking-widest text-[#E5C687] bg-[#241911] border border-[#C9A65B]/35 px-3 py-1 rounded-full font-bold">
                    {activeDemoSlide.categoryLabel}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#FAF6F0] leading-snug">
                    {activeDemoSlide.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed">
                    {activeDemoSlide.description}
                  </p>
                  <ul className="space-y-2 text-xs text-[#E6DBD0]">
                    {activeDemoSlide.highlights.map((hl, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-[#E5C687] shrink-0 mt-0.5" />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigateToSeoRoute('gallery')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-black text-xs shadow-md cursor-pointer"
                    >
                      <span>Open Full Product Demo</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLightboxSlideIndex(demoSliderIndex)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#241911] hover:bg-[#312217] border border-[#C9A65B]/40 text-[#E5C687] text-xs font-mono font-bold cursor-pointer"
                    >
                      <span>🔍 Zoom Screen</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Horizontal Swipe Thumbnail Selector Strip */}
              <div
                style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                className="flex items-center gap-2.5 overflow-x-auto pt-3 border-t border-[#C9A65B]/20 [&::-webkit-scrollbar]:hidden"
              >
                {ADMIN_GALLERY_SLIDES.map((slide, sIdx) => {
                  const isCurrent = sIdx === demoSliderIndex;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => {
                        setDemoSliderIndex(sIdx);
                        setIsDemoSliderAutoPlay(false);
                      }}
                      className={`shrink-0 w-36 sm:w-44 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[#2A1D13] border-[#E5C687] shadow-md'
                          : 'bg-[#140D09] border-[#C9A65B]/25 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={slide.imageUrl}
                        alt={slide.title}
                        className="w-full h-14 object-cover object-top rounded-lg border border-[#C9A65B]/20 mb-1"
                      />
                      <div className="text-[9.5px] font-mono text-[#E5C687] font-bold truncate">
                        {slide.categoryLabel}
                      </div>
                      <div className="text-[11px] font-serif text-[#FAF6F0] truncate">
                        {slide.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* INNER PAGE ONLY: SIMPLIFY HOTEL RESERVATIONS AND ROOM MANAGEMENT */}
      {activeSeoPage === 'hotel-reservation-software' && (
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

          <MobileSwipeGallery
            desktopGridClass="md:grid md:grid-cols-3 md:gap-5 sm:gap-6"
            label="Swipe Reservation Cards →"
          >
            <div className="h-full rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
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

            <div className="h-full rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
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

            <div className="h-full rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
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
          </MobileSwipeGallery>
        </div>
      </section>
      )}

      {/* INNER PAGE ONLY: STREAMLINE HOTEL BILLING AND INVOICING */}
      {activeSeoPage === 'hotel-billing-software' && (
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

          <MobileSwipeGallery
            desktopGridClass="md:grid md:grid-cols-3 md:gap-5 sm:gap-6"
            label="Swipe Billing Cards →"
          >
            <div className="h-full rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
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

            <div className="h-full rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
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

            <div className="h-full rounded-2xl bg-gradient-to-b from-[#1D140E]/90 to-[#120C08] border border-[#C9A65B]/25 p-6 space-y-3">
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
          </MobileSwipeGallery>
        </div>
      </section>
      )}

      {/* SECTION 4 OF 6 ON MAIN PAGE: PRICING PLANS (/pricing/) */}
      {(isMainSixSectionPage || activeSeoPage === 'free-trial') && (
      <section
        id="pricing"
        className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#0E0906] via-[#120C08] to-[#0E0906] border-t border-[#C9A65B]/15"
      >
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="max-w-3xl mx-auto text-center space-y-2.5 mb-8 sm:mb-10">
            <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/30 px-3 py-1 rounded-full">
              Transparent Subscription Plans
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
              DirectStay PMS – Pricing Plans
            </h2>

            <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed max-w-2xl mx-auto font-normal">
              {systemWebsite.pricingSubtitle ||
                'Choose a transparent subscription plan for your property with full access to reservations, room management, GST billing, POS, and reports.'}
            </p>
          </div>

          {/* Pricing Cards Gallery (Swipeable on Mobile, 4-Col Grid on Desktop) */}
          <MobileSwipeGallery
            desktopGridClass="md:grid md:grid-cols-2 xl:grid-cols-4 md:gap-5 lg:gap-6 items-stretch"
            label="Swipe Pricing Plans →"
          >
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
                      ? 'group relative mt-3 md:mt-0 flex flex-col justify-between h-full rounded-2xl bg-gradient-to-b from-[#2B1D13] via-[#1B120C] to-[#120C08] border-2 border-[#D4AF6A] p-5 sm:p-6 shadow-[0_18px_45px_rgba(212,175,106,0.14)] hover:-translate-y-1 transition-all duration-300'
                      : 'group relative mt-3 md:mt-0 flex flex-col justify-between h-full rounded-2xl bg-gradient-to-b from-[#1D140E]/90 via-[#150E0A]/95 to-[#100A07] border border-[#C9A65B]/25 hover:border-[#DFBD78]/50 p-5 sm:p-6 shadow-[0_14px_35px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300'
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
                    {plan.planKey === 'Trial' ? 'Onboard Hotel (7-Day Access)' : plan.buttonText || 'Select Package'}
                  </button>
                </div>
              );
            })}
          </MobileSwipeGallery>
        </div>
      </section>
      )}

      {/* SECTION 5 ON MAIN PAGE: ABOUT DIRECTSTAY PMS, WHY CHOOSE DIRECTSTAY, VISION & FAQS */}
      {isMainSixSectionPage && (
      <section
        id="about"
        className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-[#0B0705] border-t border-[#C9A65B]/15"
      >
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="max-w-3xl mx-auto text-center space-y-2.5">
            <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/30 px-3 py-1 rounded-full">
              About DirectStay PMS
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
              Why Choose DirectStay PMS?
            </h2>
            <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed">
              DirectStay combines cloud-based hotel management software, front-desk billing, POS, and direct booking tools into a fast, intuitive platform designed for Indian hospitality teams.
            </p>
          </div>

          <MobileSwipeGallery
            desktopGridClass="md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-5"
            label="Swipe Benefits →"
          >
            <div className="h-full rounded-2xl bg-[#160F0A] border border-[#C9A65B]/25 p-5 space-y-2">
              <h3 className="text-base font-serif font-bold text-[#E5C687]">
                15-Minute Rapid Setup
              </h3>
              <p className="text-xs text-[#C7B9A5] leading-relaxed">
                Onboard your hotel identity, room categories, and GST billing settings in minutes without expensive hardware or IT servers.
              </p>
            </div>
            <div className="h-full rounded-2xl bg-[#160F0A] border border-[#C9A65B]/25 p-5 space-y-2">
              <h3 className="text-base font-serif font-bold text-[#E5C687]">
                Zero Commission Direct Bookings
              </h3>
              <p className="text-xs text-[#C7B9A5] leading-relaxed">
                Keep 100% of your room revenue with flat, transparent SaaS subscriptions and zero per-booking commission fees.
              </p>
            </div>
            <div className="h-full rounded-2xl bg-[#160F0A] border border-[#C9A65B]/25 p-5 space-y-2">
              <h3 className="text-base font-serif font-bold text-[#E5C687]">
                Role-Based Staff &amp; Owner Access
              </h3>
              <p className="text-xs text-[#C7B9A5] leading-relaxed">
                Separate Front-Desk Admin and Hotel Owner logins protect sensitive financial reports and audit logs from unauthorized edits.
              </p>
            </div>
            <div className="h-full rounded-2xl bg-[#160F0A] border border-[#C9A65B]/25 p-5 space-y-2">
              <h3 className="text-base font-serif font-bold text-[#E5C687]">
                Dedicated Onboarding Support
              </h3>
              <p className="text-xs text-[#C7B9A5] leading-relaxed">
                Direct WhatsApp, phone, and email support for staff training, invoice customization, and property setup assistance.
              </p>
            </div>
          </MobileSwipeGallery>

          {/* Vision Statement Card */}
          <div className="rounded-3xl bg-gradient-to-b from-[#1B120C]/90 via-[#140D09]/95 to-[#0F0A07] border border-[#C9A65B]/25 p-6 sm:p-8 text-center shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
            <h3 className="text-xl sm:text-2xl font-serif font-semibold text-[#FAF6F0]">
              {systemWebsite.visionTitle || 'Pioneering Commission-Free Hospitality'}
            </h3>
            <blockquote className="mt-3 text-[#EAE0D3] text-sm sm:text-base leading-relaxed font-serif italic max-w-3xl mx-auto">
              &ldquo;{systemWebsite.visionContent || 'Our vision is to bypass middleman OTAs and empower property owners to retain 100% of their profits.'}&rdquo;
            </blockquote>
          </div>

          {/* Compact FAQs inside About Section */}
          <div className="max-w-5xl mx-auto space-y-3">
            <h3 className="text-lg sm:text-xl font-serif font-semibold text-[#FAF6F0] text-center">
              Frequently Asked Questions About DirectStay Hotel PMS
            </h3>
            {HOTEL_PMS_FAQS.slice(0, 4).map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-gradient-to-b from-[#1B120C]/90 to-[#120C08] border border-[#C9A65B]/25 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-4 sm:px-6 py-3.5 text-left flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-serif font-semibold text-[#FAF6F0]">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#E5C687] shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-6 pb-4 pt-1 text-xs sm:text-sm text-[#C7B9A5] leading-relaxed border-t border-[#C9A65B]/15">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* HOMEPAGE BLOG SECTION (Managed from SuperAdmin -> Blog Management) */}
      {isMainSixSectionPage && publishedBlogs.length > 0 && (
        <section
          id="blog"
          className="relative py-12 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#0E0906] via-[#150E09] to-[#0B0705] border-t border-[#C9A65B]/15"
        >
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="max-w-3xl mx-auto text-center space-y-2.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/35 px-3.5 py-1 rounded-full font-bold">
                <BookOpen className="w-3.5 h-3.5 text-[#D4AF6A]" />
                <span>DirectStay Hospitality Blog &amp; Insights</span>
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
                {systemWebsite.blogHeading || 'Latest Hospitality & Hotel Tech Insights'}
              </h2>
              <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed">
                {systemWebsite.blogSubtitle ||
                  'Practical guides on hotel GST billing, direct booking growth, front-desk automation, and revenue management for Indian hoteliers.'}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigateSeo('blog')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#241911] hover:bg-[#2F2016] text-[#E5C687] border border-[#C9A65B]/35 text-xs font-mono font-bold cursor-pointer transition-all"
                >
                  <span>Explore All Hospitality Guides →</span>
                </button>
              </div>
            </div>

            <MobileSwipeGallery
              desktopGridClass="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 items-stretch"
              label="Swipe Blog Articles →"
            >
              {publishedBlogs.map((blog) => (
                <article
                  key={blog.id}
                  onClick={() => navigateSeo('blog-article', undefined, blog.slug)}
                  className="group h-full rounded-2xl bg-gradient-to-b from-[#1B130C]/95 to-[#110B07]/95 border border-[#C9A65B]/25 hover:border-[#DFBD78]/65 overflow-hidden flex flex-col justify-between shadow-[0_14px_35px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                >
                  <div>
                    <div className="relative h-48 overflow-hidden bg-[#140D08]">
                      <img
                        src={blog.imageUrl}
                        alt={blog.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 left-3">
                        <span className="px-3 py-1 rounded-full bg-[#120C08]/90 border border-[#C9A65B]/45 text-[#E5C687] text-[10px] font-mono uppercase tracking-wider font-bold">
                          {blog.category}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#A89882]">
                        <span>{blog.publishedAt}</span>
                        <span>{blog.readTime || '4 min read'}</span>
                      </div>
                      <h3 className="text-lg font-serif font-bold text-[#FAF6F0] group-hover:text-[#E5C687] transition-colors leading-snug line-clamp-2">
                        {blog.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#C7B9A5] leading-relaxed line-clamp-3">
                        {blog.summary || (blog as any).excerpt}
                      </p>
                    </div>
                  </div>

                  <div className="px-6 pb-5 pt-3 border-t border-[#C9A65B]/15 flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] text-[#9E8D78]">
                      By <strong className="text-[#E6DBD0]">{blog.author}</strong>
                    </span>
                    <span className="font-serif font-bold text-[#E5C687] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                      <span>Read Article</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </article>
              ))}
            </MobileSwipeGallery>
          </div>
        </section>
      )}

      {/* SECTION 6 ON MAIN PAGE: CONTACT US */}
      {isMainSixSectionPage && (
      <section
        id="contact"
        className="relative py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#0E0906] via-[#120C08] to-[#080503] border-t border-[#C9A65B]/15"
      >
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Section Header */}
          <div className="max-w-2xl mx-auto text-center space-y-2.5">
            <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/30 px-3 py-1 rounded-full">
              Contact DirectStay PMS
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-[#FAF6F0] tracking-tight leading-[1.15]">
              {systemWebsite.contactHeading || "Let's Discuss Your Growth"}
            </h2>

            <p className="text-[#C7B9A5] text-sm sm:text-base leading-relaxed max-w-xl mx-auto font-normal">
              {systemWebsite.contactSubtitle ||
                'Get in touch directly with our support specialists for product demonstrations, subscription enquiries, onboarding and hotel management software support.'}
            </p>
          </div>

          {/* 3 Equal-Height Contact Cards (Swipeable Gallery on Mobile) */}
          <MobileSwipeGallery
            desktopGridClass="md:grid md:grid-cols-3 md:gap-5 lg:gap-6 items-stretch"
            label="Swipe Contact Channels →"
          >
            {/* Card 1: Email Us */}
            <div className="group h-full rounded-2xl bg-gradient-to-b from-[#1D140E]/90 via-[#150E0A]/95 to-[#100A07] border border-[#C9A65B]/25 hover:border-[#DFBD78]/50 p-6 flex flex-col justify-between text-center shadow-[0_14px_35px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300">
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
            <div className="group h-full rounded-2xl bg-gradient-to-b from-[#1D140E]/90 via-[#150E0A]/95 to-[#100A07] border border-[#C9A65B]/25 hover:border-[#DFBD78]/50 p-6 flex flex-col justify-between text-center shadow-[0_14px_35px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300">
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
            <div className="group h-full rounded-2xl bg-gradient-to-b from-[#1D140E]/90 via-[#150E0A]/95 to-[#100A07] border border-[#C9A65B]/25 hover:border-[#DFBD78]/50 p-6 flex flex-col justify-between text-center shadow-[0_14px_35px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300">
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
          </MobileSwipeGallery>

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
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleStartOnboard('Trial')}
                    className="inline-flex items-center gap-1.5 text-xs font-serif font-bold text-[#E5C687] hover:text-[#FAF6F0] underline underline-offset-4 cursor-pointer"
                  >
                    <Hotel className="w-3.5 h-3.5 text-[#D4AF6A]" />
                    <span>Want to onboard your hotel now? Click here to Register Property →</span>
                  </button>
                </div>
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
                  <option value="Hotel Property Onboarding">Hotel Property Onboarding</option>
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
      )}

      {/* FLOATING WHATSAPP BUTTON (Raised above Mobile Bottom Navbar) */}
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
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 w-13 h-13 lg:w-14 lg:h-14 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white flex items-center justify-center shadow-[0_8px_28px_rgba(37,211,102,0.45)] hover:shadow-[0_12px_36px_rgba(37,211,102,0.65)] hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/25 cursor-pointer"
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
      <footer className="border-t border-[#C9A65B]/25 bg-[#080503] text-[#C7B9A5] pb-24 lg:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 pb-8 border-b border-[#C9A65B]/15">
            {/* Brand Column */}
            <div className="lg:col-span-3 space-y-4">
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
              <ul className="space-y-2 text-xs sm:text-[13px]">
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

            {/* Company & Portals */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5C687] font-semibold">
                {systemWebsite.footerEnterpriseTitle || 'Company & Portals'}
              </h3>
              <ul className="space-y-2 text-xs sm:text-[13px]">
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
                  <a
                    href="/blog/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSeoRoute('blog');
                    }}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    Hospitality Blog &amp; Guides
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onNavigateToLogin}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    Sign In
                  </button>
                </li>
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

            {/* Legal & Compliance Pages */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5C687] font-semibold">
                Legal &amp; Compliance
              </h3>
              <ul className="space-y-2 text-xs sm:text-[13px]">
                <li>
                  <a
                    href="/privacy-policy/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSeoRoute('privacy-policy');
                    }}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="/terms-and-conditions/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSeoRoute('terms-and-conditions');
                    }}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    Terms &amp; Conditions
                  </a>
                </li>
                <li>
                  <a
                    href="/refund-policy/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSeoRoute('refund-policy');
                    }}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    Refund &amp; Cancellation
                  </a>
                </li>
                <li>
                  <a
                    href="/data-security/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSeoRoute('data-security');
                    }}
                    className="hover:text-[#E5C687] transition-colors text-left cursor-pointer"
                  >
                    Data Security &amp; Isolation
                  </a>
                </li>
              </ul>
            </div>

            {/* Direct Contact Summary */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5C687] font-semibold">
                {systemWebsite.footerDirectDeskTitle || 'Direct Desk'}
              </h3>
              <ul className="space-y-2 text-xs text-[#B7A691]">
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
            <div className="space-y-1.5">
              <p className="font-mono text-[11px] sm:text-xs text-[#B7A691]">
                {`© ${systemWebsite.businessName || 'DirectStay'}. All rights reserved. • Email: ${systemWebsite.supportEmail} • Support: ${formattedSupportPhone}`}
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-[11px] text-[#C7B9A5]">
                <a
                  href="/privacy-policy/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSeoRoute('privacy-policy');
                  }}
                  className="hover:text-[#E5C687] underline underline-offset-2 cursor-pointer"
                >
                  Privacy Policy
                </a>
                <span>•</span>
                <a
                  href="/terms-and-conditions/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSeoRoute('terms-and-conditions');
                  }}
                  className="hover:text-[#E5C687] underline underline-offset-2 cursor-pointer"
                >
                  Terms &amp; Conditions
                </a>
                <span>•</span>
                <a
                  href="/refund-policy/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSeoRoute('refund-policy');
                  }}
                  className="hover:text-[#E5C687] underline underline-offset-2 cursor-pointer"
                >
                  Refund Policy
                </a>
                <span>•</span>
                <a
                  href="/data-security/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSeoRoute('data-security');
                  }}
                  className="hover:text-[#E5C687] underline underline-offset-2 cursor-pointer"
                >
                  Data Security
                </a>
                <span>•</span>
                <a
                  href="/blog/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSeoRoute('blog');
                  }}
                  className="hover:text-[#E5C687] underline underline-offset-2 cursor-pointer"
                >
                  Blog &amp; Articles
                </a>
              </div>
            </div>
            <p className="text-[11px] text-[#9E8D78]">
              All listed subscription packages are subject to 5% GST (2.5% CGST + 2.5% SGST) standard regulations.
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

                {/* Room Tiers Selection (Swipeable on Mobile) */}
                <div className="pt-1">
                  <MobileSwipeGallery
                    desktopGridClass="md:grid md:grid-cols-2 md:gap-3"
                    cardWidthClass="w-[78vw] max-w-[260px] md:w-auto md:max-w-none"
                    label="Swipe Room Tiers →"
                  >
                    <button 
                      type="button"
                      onClick={() => setRoomTier('1-10')}
                      className={`h-full p-3.5 sm:p-4 rounded-xl border text-left transition-all whitespace-normal min-w-0 overflow-hidden ${roomTier === '1-10' ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-white' : 'border-[#8C7355]/20 bg-black/30 hover:border-luxury-gold-500/20'}`}
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
                      className={`h-full p-3.5 sm:p-4 rounded-xl border text-left transition-all whitespace-normal min-w-0 overflow-hidden ${roomTier === '10-20' ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-white' : 'border-[#8C7355]/20 bg-black/30 hover:border-luxury-gold-500/20'}`}
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
                      className={`h-full p-3.5 sm:p-4 rounded-xl border text-left transition-all whitespace-normal min-w-0 overflow-hidden ${roomTier === '20-30' ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-white' : 'border-[#8C7355]/20 bg-black/30 hover:border-luxury-gold-500/20'}`}
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
                      className={`h-full p-3.5 sm:p-4 rounded-xl border text-left transition-all whitespace-normal min-w-0 overflow-hidden ${roomTier === '30-50' ? 'border-luxury-gold-500 bg-luxury-gold-500/10 font-bold text-white' : 'border-[#8C7355]/20 bg-black/30 hover:border-luxury-gold-500/20'}`}
                    >
                      <div className="flex justify-between items-center mb-1 gap-2">
                        <span className="text-sm font-serif">30 to 50 Rooms</span>
                        {roomTier === '30-50' && <Check className="w-4 h-4 text-luxury-gold-400 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-luxury-brown-300 leading-relaxed whitespace-normal break-words font-normal">Enterprise Resort scale. Pre-generates 40 rooms across standard and luxury suites.</p>
                    </button>
                  </MobileSwipeGallery>
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
                      : `Billed at ₹${planDetails.price.toLocaleString()} + 5% GST (2.5% CGST + 2.5% SGST = ₹${totalAmount.toLocaleString()} total) for ${planDetails.period}.`}
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
                  <p className="text-xs text-luxury-brown-200">Review your plan price including legally calculated 5% GST (2.5% CGST + 2.5% SGST).</p>
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

                {/* UPI/Mock gateway details */}
                <div className="p-4 bg-luxury-gold-500/5 border border-luxury-gold-500/10 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-luxury-gold-400 font-bold">
                    <CreditCard className="w-4 h-4" /> Secure Sandbox Payment Portal
                  </div>
                  <p className="text-[10px] text-luxury-brown-200 leading-normal">
                    {selectedPlan === 'Trial' 
                      ? 'No actual transaction is scheduled. Clicking launch registers your 7-day free trial tier instantly.'
                      : `Mock authorization: In production, this proxies to a secure UPI/Gateway. Click launch to simulate successful payment of ₹${totalAmount.toLocaleString()} and activate standard service.`}
                  </p>
                </div>

                {/* Stepper buttons */}
                <div className="pt-4 border-t border-luxury-gold-500/10 flex justify-between items-center">
                  <button 
                    onClick={() => setCurrentStep('inventory')}
                    className="text-xs text-luxury-brown-300 hover:text-white"
                  >
                    ← Back to Room Inventory
                  </button>
                  <button 
                    type="button"
                    onClick={handleOnboardSubmit}
                    disabled={isSubmittingOnboard}
                    className="inline-flex items-center gap-2 py-3.5 px-8 bg-gradient-to-r from-luxury-gold-500 to-[#8C7355] text-luxury-brown-950 font-serif font-black text-sm rounded-xl shadow-xl shadow-luxury-gold-500/10 hover:scale-102 disabled:opacity-50"
                  >
                    <span>Launch Property PMS</span>
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
              {activeCustomPage.imageUrl && (
                <img
                  src={activeCustomPage.imageUrl}
                  alt={activeCustomPage.title}
                  className="w-full h-56 object-cover rounded-2xl border border-luxury-gold-500/20"
                />
              )}
              <div className="text-sm text-[#e2d5c5]/85 leading-relaxed whitespace-pre-line font-sans">
                {activeCustomPage.content}
              </div>
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

      {/* FULL-SCREEN /ADMIN SCREENSHOT LIGHTBOX ZOOM MODAL */}
      {lightboxSlideIndex !== null && ADMIN_GALLERY_SLIDES[lightboxSlideIndex] && (
        <div
          onClick={() => setLightboxSlideIndex(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-md p-3 sm:p-6 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#140D09] border-2 border-[#D4AF6A]/45 rounded-2xl sm:rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] max-w-6xl w-full overflow-hidden flex flex-col max-h-[94vh]"
          >
            {/* Top Bar */}
            <div className="bg-[#0C0805] px-4 sm:px-6 py-3.5 border-b border-[#C9A65B]/25 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#120C08] bg-[#E5C687] px-2.5 py-0.5 rounded-full font-extrabold shrink-0">
                  Screen {lightboxSlideIndex + 1} / {ADMIN_GALLERY_SLIDES.length}
                </span>
                <span className="text-[11px] font-mono text-[#E5C687] bg-[#1F150E] border border-[#C9A65B]/35 px-2.5 py-0.5 rounded-md truncate">
                  {ADMIN_GALLERY_SLIDES[lightboxSlideIndex].routeBadge}
                </span>
                <h3 className="text-sm sm:text-lg font-serif font-bold text-[#FAF6F0] truncate">
                  {ADMIN_GALLERY_SLIDES[lightboxSlideIndex].title}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setLightboxSlideIndex((prev) =>
                      prev !== null
                        ? (prev - 1 + ADMIN_GALLERY_SLIDES.length) % ADMIN_GALLERY_SLIDES.length
                        : 0
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#241911] hover:bg-[#2F2016] text-[#FAF6F0] border border-[#C9A65B]/35 text-xs font-mono cursor-pointer"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxSlideIndex((prev) =>
                      prev !== null ? (prev + 1) % ADMIN_GALLERY_SLIDES.length : 0
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#241911] hover:bg-[#2F2016] text-[#FAF6F0] border border-[#C9A65B]/35 text-xs font-mono cursor-pointer"
                >
                  Next →
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxSlideIndex(null)}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-400/40 text-xs font-mono font-bold cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Screenshot Image */}
            <div className="bg-black flex-1 overflow-auto flex items-center justify-center p-2 sm:p-4">
              <img
                src={ADMIN_GALLERY_SLIDES[lightboxSlideIndex].imageUrl}
                alt={ADMIN_GALLERY_SLIDES[lightboxSlideIndex].title}
                className="w-full h-auto max-h-[68vh] object-contain rounded-xl border border-[#C9A65B]/25 shadow-2xl"
              />
            </div>

            {/* Bottom Caption & Highlights */}
            <div className="bg-[#120C08] px-4 sm:px-6 py-4 border-t border-[#C9A65B]/25 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
              <div className="space-y-1.5 max-w-3xl">
                <p className="text-xs sm:text-sm text-[#EAE0D3] leading-relaxed">
                  {ADMIN_GALLERY_SLIDES[lightboxSlideIndex].description}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {ADMIN_GALLERY_SLIDES[lightboxSlideIndex].highlights.map((h, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[10.5px] font-mono text-[#E5C687] bg-[#1E140D] border border-[#C9A65B]/30 px-2.5 py-0.5 rounded-full"
                    >
                      <Check className="w-3 h-3 text-[#E5C687]" />
                      <span>{h}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setLightboxSlideIndex(null);
                    handleStartOnboard('Trial');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E5C687] via-[#D4AF6A] to-[#B88E42] text-[#120C08] font-serif font-black text-xs shadow-md cursor-pointer"
                >
                  <span>Try This Module Free (7 Days)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
