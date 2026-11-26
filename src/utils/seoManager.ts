export const DIRECTSTAY_DOMAIN = 'https://directstay.online';

export type PublicSeoPageKey =
  | 'home'
  | 'features'
  | 'gallery'
  | 'pricing'
  | 'free-trial'
  | 'hotel-reservation-software'
  | 'hotel-billing-software'
  | 'about'
  | 'contact'
  | 'privacy-policy'
  | 'terms-and-conditions'
  | 'refund-policy'
  | 'data-security'
  | 'blog'
  | 'blog-article';

export interface PublicSeoPageConfig {
  key: PublicSeoPageKey;
  path: string;
  canonicalUrl: string;
  title: string;
  description: string;
  h1: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  breadcrumbLabel: string;
}

export const PUBLIC_SEO_PAGES: Record<PublicSeoPageKey, PublicSeoPageConfig> = {
  home: {
    key: 'home',
    path: '/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/`,
    title: 'Hotel Management Software & PMS for Hotels | DirectStay',
    description:
      'Manage hotel reservations, room inventory, check-ins, billing and reports with DirectStay PMS. Start your 7-day free trial today.',
    h1: 'Hotel Management Software to Simplify Your Hotel Operations',
    primaryKeyword: 'Hotel Management Software',
    secondaryKeywords: [
      'Hotel PMS Software',
      'Property Management System for Hotels',
      'Hotel Reservation Software',
      'Hotel Billing Software',
      'Hotel Front Desk Software',
      'Hotel Room Management Software',
      'Hotel Booking Management System',
      'Cloud-Based Hotel Management Software',
    ],
    breadcrumbLabel: 'Home',
  },
  features: {
    key: 'features',
    path: '/features/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/features/`,
    title: 'Hotel PMS Features for Modern Hotels | DirectStay',
    description:
      'Explore DirectStay PMS features for hotel reservations, room management, check-ins, billing, invoicing and reports in one platform.',
    h1: 'Hotel Management Software Features',
    primaryKeyword: 'Hotel PMS Features',
    secondaryKeywords: [
      'Hotel Front Desk Software',
      'Hotel Room Management Software',
      'Housekeeping Management Software',
      'Hotel POS and Billing System',
    ],
    breadcrumbLabel: 'Features',
  },
  gallery: {
    key: 'gallery',
    path: '/gallery/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/gallery/`,
    title: 'Hotel PMS Admin Panel Screenshots & Product Demo Gallery | DirectStay',
    description:
      'Explore real screenshots and interactive product walkthroughs of the DirectStay PMS Admin Panel: Live Room Rack, Front Desk Check-In, GST Billing, Restaurant POS, and Finance Hub.',
    h1: 'DirectStay PMS Admin Panel Gallery & Live Product Tour',
    primaryKeyword: 'Hotel PMS Admin Panel Demo',
    secondaryKeywords: [
      'Hotel Software Screenshots',
      'Hotel PMS Dashboard Preview',
      'Hotel Billing & POS Demo',
      'Hotel Front Desk Console Tour',
    ],
    breadcrumbLabel: 'Product Gallery & Demo',
  },
  pricing: {
    key: 'pricing',
    path: '/pricing/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/pricing/`,
    title: 'Hotel Management Software Pricing | DirectStay PMS',
    description:
      'Explore DirectStay PMS pricing plans for hotels. Compare features, choose the right subscription and start your 7-day free trial.',
    h1: 'Simple and Transparent Hotel PMS Pricing',
    primaryKeyword: 'Hotel Management Software Pricing',
    secondaryKeywords: [
      'Hotel PMS Subscription Plans',
      'Hotel Software Cost India',
      'Cloud Hotel PMS Pricing',
    ],
    breadcrumbLabel: 'Pricing',
  },
  'free-trial': {
    key: 'free-trial',
    path: '/free-trial/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/free-trial/`,
    title: 'Try Hotel Management Software Free for 7 Days | DirectStay',
    description:
      'Try DirectStay hotel management software free for 7 days. Explore hotel operations, reservations, billing and reporting before subscribing.',
    h1: 'Start Your 7-Day Free Trial of DirectStay PMS',
    primaryKeyword: 'Free Hotel Management Software Trial',
    secondaryKeywords: [
      '7-Day Free Hotel PMS Trial',
      'Try Hotel PMS Software Free',
      'Hotel Property Management Trial',
    ],
    breadcrumbLabel: '7-Day Free Trial',
  },
  'hotel-reservation-software': {
    key: 'hotel-reservation-software',
    path: '/hotel-reservation-software/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/hotel-reservation-software/`,
    title: 'Hotel Reservation Management Software | DirectStay',
    description:
      'Manage hotel reservations, room availability and booking records with DirectStay PMS. Simplify reservation management for your hotel.',
    h1: 'Hotel Reservation Management Software',
    primaryKeyword: 'Hotel Reservation Software',
    secondaryKeywords: [
      'Hotel Booking Management System',
      'Room Availability Calendar Software',
      'Front Desk Walk-In and Advance Booking',
    ],
    breadcrumbLabel: 'Hotel Reservation Software',
  },
  'hotel-billing-software': {
    key: 'hotel-billing-software',
    path: '/hotel-billing-software/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/hotel-billing-software/`,
    title: 'Hotel Billing and Invoice Software | DirectStay PMS',
    description:
      'Simplify hotel billing, guest invoices and payment records with DirectStay PMS. Manage daily hotel billing from one platform.',
    h1: 'Hotel Billing Software for Hotels',
    primaryKeyword: 'Hotel Billing Software',
    secondaryKeywords: [
      'Hotel GST Invoice Software',
      'Hotel Folio and Check-Out Billing',
      'Restaurant POS and Room Billing',
    ],
    breadcrumbLabel: 'Hotel Billing Software',
  },
  about: {
    key: 'about',
    path: '/about/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/about/`,
    title: 'About DirectStay | Hotel Management Software',
    description:
      'Learn about DirectStay PMS and our mission to help hotels simplify reservations, billing and everyday hotel operations.',
    h1: 'About DirectStay PMS',
    primaryKeyword: 'About DirectStay PMS',
    secondaryKeywords: [
      'DirectStay Hotel Software',
      'Cloud Property Management System',
      'Hospitality Technology India',
    ],
    breadcrumbLabel: 'About Us',
  },
  contact: {
    key: 'contact',
    path: '/contact/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/contact/`,
    title: 'Contact DirectStay PMS | Hotel Software Demo and Support',
    description:
      'Contact DirectStay PMS for product demonstrations, subscription enquiries, onboarding and hotel management software support.',
    h1: 'Contact DirectStay PMS',
    primaryKeyword: 'Contact DirectStay PMS',
    secondaryKeywords: [
      'Hotel PMS Demo',
      'DirectStay Customer Support',
      'Hotel Software Onboarding',
    ],
    breadcrumbLabel: 'Contact',
  },
  'privacy-policy': {
    key: 'privacy-policy',
    path: '/privacy-policy/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/privacy-policy/`,
    title: 'Privacy Policy | DirectStay Hotel Management Software (PMS)',
    description:
      'Read the DirectStay PMS Privacy Policy covering hotel tenant data isolation, guest GRC document privacy, DPDP Act 2023 compliance, and cloud encryption.',
    h1: 'Privacy Policy — DirectStay PMS',
    primaryKeyword: 'DirectStay Privacy Policy',
    secondaryKeywords: [
      'Hotel Guest Data Privacy',
      'DPDP Act 2023 Compliance',
      'Hotel PMS Data Protection',
    ],
    breadcrumbLabel: 'Privacy Policy',
  },
  'terms-and-conditions': {
    key: 'terms-and-conditions',
    path: '/terms-and-conditions/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/terms-and-conditions/`,
    title: 'Terms & Conditions | DirectStay Hotel Management Software (PMS)',
    description:
      'Review the Terms & Conditions for DirectStay PMS SaaS subscriptions, 7-day free trial usage, GST billing compliance, and hotel data ownership.',
    h1: 'Terms & Conditions (SaaS Agreement)',
    primaryKeyword: 'DirectStay Terms and Conditions',
    secondaryKeywords: [
      'Hotel PMS SaaS Agreement',
      'DirectStay Subscription Terms',
      'Hotel Software License Terms',
    ],
    breadcrumbLabel: 'Terms & Conditions',
  },
  'refund-policy': {
    key: 'refund-policy',
    path: '/refund-policy/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/refund-policy/`,
    title: 'Refund & Cancellation Policy | DirectStay PMS',
    description:
      'Transparent Refund & Cancellation Policy for DirectStay PMS 7-day free trials, monthly packs, annual subscriptions, and data export guarantees.',
    h1: 'Refund & Subscription Cancellation Policy',
    primaryKeyword: 'DirectStay Refund Policy',
    secondaryKeywords: [
      'Hotel PMS Cancellation Policy',
      '7-Day Free Trial Terms',
      'Subscription Refund Policy',
    ],
    breadcrumbLabel: 'Refund & Cancellation Policy',
  },
  'data-security': {
    key: 'data-security',
    path: '/data-security/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/data-security/`,
    title: 'Data Security & Multi-Tenant Cloud Isolation | DirectStay PMS',
    description:
      'Learn how DirectStay PMS protects your hotel rooms, financial ledgers, and guest records with strict multi-tenant isolation, RBAC, and immutable audit logs.',
    h1: 'Data Security & Multi-Tenant Cloud Isolation',
    primaryKeyword: 'Hotel PMS Data Security',
    secondaryKeywords: [
      'Multi-Tenant Hotel Cloud Security',
      'Role-Based Access Control PMS',
      'Hotel Financial Data Isolation',
    ],
    breadcrumbLabel: 'Data Security & Isolation',
  },
  blog: {
    key: 'blog',
    path: '/blog/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/blog/`,
    title: 'Hospitality & Hotel Tech Blog | DirectStay Hotel PMS Guides',
    description:
      'Read expert hospitality guides, hotel GST billing tips, direct booking growth strategies, and front-desk automation best practices from DirectStay PMS.',
    h1: 'DirectStay Hospitality & Hotel Management Blog',
    primaryKeyword: 'Hotel Management Blog',
    secondaryKeywords: [
      'Hotel PMS Guides',
      'Hotel GST Invoicing Tips',
      'Direct Hotel Booking Strategies',
      'Front Desk Automation Advice',
    ],
    breadcrumbLabel: 'Blog',
  },
  'blog-article': {
    key: 'blog-article',
    path: '/blog/',
    canonicalUrl: `${DIRECTSTAY_DOMAIN}/blog/`,
    title: 'Hotel Management Insights & Articles | DirectStay PMS',
    description:
      'In-depth articles and operational playbooks for boutique hotels, resorts, and modern hospitality operators.',
    h1: 'DirectStay Hotel Management Articles',
    primaryKeyword: 'Hotel Operations Playbooks',
    secondaryKeywords: ['Hotel Tech Insights', 'Hotel SaaS Guides'],
    breadcrumbLabel: 'Blog Post',
  },
};

// Legacy slug redirects (301/replaceState mapping for permanently changed URLs)
export const LEGACY_SEO_REDIRECTS: Record<string, PublicSeoPageKey> = {
  feature: 'features',
  'hotel-pms-features': 'features',
  'demo-gallery': 'gallery',
  screenshots: 'gallery',
  'admin-gallery': 'gallery',
  price: 'pricing',
  plans: 'pricing',
  'pricing-plans': 'pricing',
  trial: 'free-trial',
  'start-free-trial': 'free-trial',
  onboarding: 'free-trial',
  reservations: 'hotel-reservation-software',
  'reservation-software': 'hotel-reservation-software',
  billing: 'hotel-billing-software',
  'invoice-software': 'hotel-billing-software',
  'about-us': 'about',
  vision: 'about',
  'contact-us': 'contact',
  demo: 'contact',
  privacy: 'privacy-policy',
  terms: 'terms-and-conditions',
  refund: 'refund-policy',
  cancellation: 'refund-policy',
  security: 'data-security',
  blogs: 'blog',
  articles: 'blog',
  posts: 'blog',
};

export function resolvePublicSeoPageFromPath(pathname: string): {
  pageKey: PublicSeoPageKey | null;
  redirectToPath?: string;
  blogSlug?: string;
} {
  const clean = (pathname || '/').trim().replace(/\/+$/, '').toLowerCase();
  if (clean === '' || clean === '/' || clean === '/prototype' || clean === '/mobile-prototype') {
    return { pageKey: 'home' };
  }
  const rawSegs = clean.split('/').filter(Boolean);
  const segs =
    rawSegs[0] === 'prototype' || rawSegs[0] === 'mobile-prototype'
      ? rawSegs.slice(1)
      : rawSegs;
  if (segs.length === 0) {
    return { pageKey: 'home' };
  }

  // Handle /blog and /blog/:slug
  if (segs[0] === 'blog' || segs[0] === 'blogs') {
    if (segs.length === 1) {
      if (segs[0] === 'blogs') {
        return { pageKey: 'blog', redirectToPath: '/blog/' };
      }
      return { pageKey: 'blog' };
    }
    if (segs.length === 2) {
      const slug = segs[1];
      if (segs[0] === 'blogs') {
        return { pageKey: 'blog-article', blogSlug: slug, redirectToPath: `/blog/${slug}/` };
      }
      return { pageKey: 'blog-article', blogSlug: slug };
    }
    return { pageKey: null };
  }

  if (segs.length !== 1) {
    return { pageKey: null };
  }
  const slug = segs[0];
  if (slug in PUBLIC_SEO_PAGES && slug !== 'home') {
    return { pageKey: slug as PublicSeoPageKey };
  }
  if (slug in LEGACY_SEO_REDIRECTS) {
    const targetKey = LEGACY_SEO_REDIRECTS[slug];
    return {
      pageKey: targetKey,
      redirectToPath: PUBLIC_SEO_PAGES[targetKey].path,
    };
  }
  return { pageKey: null };
}

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLinkTag(rel: string, href: string) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function buildStructuredDataJsonLd(
  pageKey: PublicSeoPageKey,
  options?: {
    businessName?: string;
    supportPhone?: string;
    supportEmail?: string;
    contactAddress?: string;
    logoUrl?: string;
    blogPost?: {
      title: string;
      slug: string;
      summary?: string;
      author?: string;
      publishedAt?: string;
      imageUrl?: string;
      category?: string;
    };
  }
) {
  const page = PUBLIC_SEO_PAGES[pageKey] || PUBLIC_SEO_PAGES.home;
  const orgName = options?.businessName || 'DirectStay';
  const phone = options?.supportPhone || '+91-7978563771';
  const email = options?.supportEmail || 'contact@directstay.online';
  const address = options?.contactAddress || 'Puri & Bhubaneswar, Odisha, India';
  const logo = options?.logoUrl
    ? options.logoUrl.startsWith('http')
      ? options.logoUrl
      : `${DIRECTSTAY_DOMAIN}${options.logoUrl}`
    : `${DIRECTSTAY_DOMAIN}/favicon.svg`;

  const graph: Record<string, any>[] = [
    {
      '@type': 'Organization',
      '@id': `${DIRECTSTAY_DOMAIN}/#organization`,
      name: orgName,
      legalName: 'DirectStay PMS',
      url: `${DIRECTSTAY_DOMAIN}/`,
      logo: {
        '@type': 'ImageObject',
        url: logo,
      },
      contactPoint: [
        {
          '@type': 'ContactPoint',
          telephone: phone.startsWith('+') ? phone : `+91-${phone.replace(/\D/g, '').slice(-10)}`,
          contactType: 'customer support',
          email,
          areaServed: 'IN',
          availableLanguage: ['English', 'Hindi'],
        },
      ],
      address: {
        '@type': 'PostalAddress',
        streetAddress: address,
        addressCountry: 'IN',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${DIRECTSTAY_DOMAIN}/#website`,
      url: `${DIRECTSTAY_DOMAIN}/`,
      name: 'DirectStay PMS — Hotel Management Software',
      publisher: {
        '@id': `${DIRECTSTAY_DOMAIN}/#organization`,
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${DIRECTSTAY_DOMAIN}/#software`,
      name: 'DirectStay PMS',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Hotel Property Management System (PMS)',
      operatingSystem: 'Web Browser (Cloud-Based SaaS)',
      url: `${DIRECTSTAY_DOMAIN}/`,
      description: PUBLIC_SEO_PAGES.home.description,
      provider: {
        '@id': `${DIRECTSTAY_DOMAIN}/#organization`,
      },
      featureList: [
        'Hotel Reservation Management & Room Availability Calendar',
        'Express Guest Check-In, Walk-In & Digital ID Verification (GRC)',
        'Room Inventory, Base & Max Occupancy & Dynamic Rate Control',
        'GST-Compliant Hotel Billing, Folio Management & Tax Invoicing',
        'Housekeeping Status Tracking, Laundry & Room Service Allocation',
        'Restaurant POS Terminal, Inventory Stock Ledger & Daily Financial Reports',
      ],
      offers: [
        {
          '@type': 'Offer',
          name: '7-Day Free Trial',
          price: '0',
          priceCurrency: 'INR',
          description: '7-day free evaluation of DirectStay PMS features with zero setup charges.',
          url: `${DIRECTSTAY_DOMAIN}/free-trial/`,
        },
        {
          '@type': 'Offer',
          name: 'Monthly Pack',
          price: '1899',
          priceCurrency: 'INR',
          description: 'Monthly hotel PMS subscription (Total ₹2,241 with 18% GST).',
          url: `${DIRECTSTAY_DOMAIN}/pricing/`,
        },
        {
          '@type': 'Offer',
          name: 'Annual Pack – Special Offer',
          price: '5999',
          priceCurrency: 'INR',
          description: 'Annual Special Offer (50% OFF from ₹11,999; Total ₹7,079 with 18% GST).',
          url: `${DIRECTSTAY_DOMAIN}/pricing/`,
        },
        {
          '@type': 'Offer',
          name: 'Premium Property Pack',
          price: '17000',
          priceCurrency: 'INR',
          description: 'Complete Hotel Management + OTA Connectivity (Total ₹17,850 with 5% GST).',
          url: `${DIRECTSTAY_DOMAIN}/pricing/`,
        },
      ],
    },
  ];

  if (pageKey === 'blog-article' && options?.blogPost) {
    const bp = options.blogPost;
    graph.push({
      '@type': 'BlogPosting',
      '@id': `${DIRECTSTAY_DOMAIN}/blog/${bp.slug}/#article`,
      isPartOf: {
        '@type': 'WebSite',
        '@id': `${DIRECTSTAY_DOMAIN}/#website`,
      },
      headline: bp.title,
      description: bp.summary || '',
      image: bp.imageUrl || `${DIRECTSTAY_DOMAIN}/hero-resort.jpg`,
      datePublished: bp.publishedAt || new Date().toISOString().split('T')[0],
      dateModified: bp.publishedAt || new Date().toISOString().split('T')[0],
      author: {
        '@type': 'Person',
        name: bp.author || 'DirectStay Editorial Desk',
      },
      publisher: {
        '@id': `${DIRECTSTAY_DOMAIN}/#organization`,
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${DIRECTSTAY_DOMAIN}/blog/${bp.slug}/`,
      },
    });

    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${DIRECTSTAY_DOMAIN}/blog/${bp.slug}/#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${DIRECTSTAY_DOMAIN}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Blog',
          item: `${DIRECTSTAY_DOMAIN}/blog/`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: bp.title,
          item: `${DIRECTSTAY_DOMAIN}/blog/${bp.slug}/`,
        },
      ],
    });
  } else if (pageKey !== 'home') {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${page.canonicalUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${DIRECTSTAY_DOMAIN}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: page.breadcrumbLabel,
          item: page.canonicalUrl,
        },
      ],
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function applySeoHeadTags(
  pageKey: PublicSeoPageKey,
  options?: {
    businessName?: string;
    supportPhone?: string;
    supportEmail?: string;
    contactAddress?: string;
    logoUrl?: string;
    seoSettings?: {
      siteUrl?: string;
      defaultTitle?: string;
      defaultDescription?: string;
      defaultOgImage?: string;
      googleSiteVerification?: string;
      googleAnalyticsId?: string;
      pageSeoOverrides?: Record<
        string,
        {
          seoTitle?: string;
          metaDescription?: string;
          customSlug?: string;
          canonicalUrl?: string;
          focusKeyword?: string;
          ogTitle?: string;
          ogDescription?: string;
          ogImage?: string;
          imageAlt?: string;
          robotsIndex?: 'index' | 'noindex';
          robotsFollow?: 'follow' | 'nofollow';
          schemaType?: 'WebPage' | 'SoftwareApplication' | 'Organization' | 'FAQPage' | 'Article';
        }
      >;
    };
    customPage?: {
      title: string;
      slug: string;
      content?: string;
      imageUrl?: string;
      featuredImageUrl?: string;
      seo?: {
        seoTitle?: string;
        metaDescription?: string;
        canonicalUrl?: string;
        focusKeyword?: string;
        ogTitle?: string;
        ogDescription?: string;
        ogImage?: string;
        robotsIndex?: 'index' | 'noindex';
        robotsFollow?: 'follow' | 'nofollow';
      };
    };
    blogPost?: {
      title: string;
      slug: string;
      summary?: string;
      author?: string;
      publishedAt?: string;
      imageUrl?: string;
      category?: string;
      tags?: string[];
      seo?: {
        seoTitle?: string;
        metaDescription?: string;
        canonicalUrl?: string;
        focusKeyword?: string;
        ogTitle?: string;
        ogDescription?: string;
        ogImage?: string;
        robotsIndex?: 'index' | 'noindex';
        robotsFollow?: 'follow' | 'nofollow';
      };
    };
  }
) {
  if (typeof document === 'undefined') return;
  const page = PUBLIC_SEO_PAGES[pageKey] || PUBLIC_SEO_PAGES.home;
  const siteUrl = String(options?.seoSettings?.siteUrl || DIRECTSTAY_DOMAIN).replace(/\/+$/, '');
  const override = options?.seoSettings?.pageSeoOverrides?.[pageKey];
  const itemSeo = options?.customPage?.seo || (pageKey === 'blog-article' ? options?.blogPost?.seo : undefined);

  const allKeywords = [
    itemSeo?.focusKeyword || override?.focusKeyword || page.primaryKeyword,
    ...(options?.blogPost?.tags || []),
    ...page.secondaryKeywords,
  ]
    .filter(Boolean)
    .join(', ');

  const defaultOg = options?.seoSettings?.defaultOgImage || `${siteUrl}/hero-resort.jpg`;
  const ogImage =
    itemSeo?.ogImage ||
    override?.ogImage ||
    options?.customPage?.featuredImageUrl ||
    options?.customPage?.imageUrl ||
    (pageKey === 'blog-article' && options?.blogPost?.imageUrl ? options.blogPost.imageUrl : defaultOg);

  const pageTitle =
    itemSeo?.seoTitle ||
    override?.seoTitle ||
    (options?.customPage
      ? `${options.customPage.title} | ${options.businessName || 'DirectStay PMS'}`
      : pageKey === 'blog-article' && options?.blogPost
      ? `${options.blogPost.title} | ${options.businessName || 'DirectStay PMS'}`
      : page.title);

  const pageDesc =
    itemSeo?.metaDescription ||
    override?.metaDescription ||
    (options?.customPage?.content
      ? options.customPage.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
      : pageKey === 'blog-article' && options?.blogPost?.summary
      ? options.blogPost.summary
      : page.description);

  const customSlugClean = override?.customSlug
    ? `/${String(override.customSlug).replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/+$/, '/')
    : '';
  const canonicalUrl =
    itemSeo?.canonicalUrl ||
    override?.canonicalUrl ||
    (options?.customPage
      ? `${siteUrl}/page/${String(options.customPage.slug || '').replace(/^\/+|\/+$/g, '')}`
      : pageKey === 'blog-article' && options?.blogPost
      ? `${siteUrl}/blog/${options.blogPost.slug}/`
      : customSlugClean
      ? `${siteUrl}${customSlugClean}`
      : page.canonicalUrl);

  const imageAlt =
    (itemSeo as any)?.imageAlt ||
    override?.imageAlt ||
    pageTitle;

  const robotsIndex = itemSeo?.robotsIndex || override?.robotsIndex || 'index';
  const robotsFollow = itemSeo?.robotsFollow || override?.robotsFollow || 'follow';
  const robotsContent =
    robotsIndex === 'noindex'
      ? `${robotsIndex}, ${robotsFollow}`
      : `${robotsIndex}, ${robotsFollow}, max-image-preview:large, max-snippet:-1, max-video-preview:-1`;

  document.title = pageTitle;
  upsertMetaTag('name', 'description', pageDesc);
  upsertMetaTag('name', 'keywords', allKeywords);
  upsertMetaTag('name', 'robots', robotsContent);
  upsertLinkTag('canonical', canonicalUrl);

  // Open Graph metadata
  upsertMetaTag('property', 'og:type', pageKey === 'blog-article' ? 'article' : 'website');
  upsertMetaTag('property', 'og:site_name', options?.businessName || 'DirectStay PMS');
  upsertMetaTag('property', 'og:title', itemSeo?.ogTitle || override?.ogTitle || pageTitle);
  upsertMetaTag('property', 'og:description', itemSeo?.ogDescription || override?.ogDescription || pageDesc);
  upsertMetaTag('property', 'og:url', canonicalUrl);
  upsertMetaTag('property', 'og:image', ogImage);
  upsertMetaTag('property', 'og:image:alt', imageAlt);
  upsertMetaTag('property', 'og:locale', 'en_IN');

  // Twitter Card metadata
  upsertMetaTag('name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('name', 'twitter:title', itemSeo?.ogTitle || override?.ogTitle || pageTitle);
  upsertMetaTag('name', 'twitter:description', itemSeo?.ogDescription || override?.ogDescription || pageDesc);
  upsertMetaTag('name', 'twitter:image', ogImage);
  upsertMetaTag('name', 'twitter:image:alt', imageAlt);

  // Google Search Console verification & GA4 Analytics
  if (options?.seoSettings?.googleSiteVerification?.trim()) {
    upsertMetaTag('name', 'google-site-verification', options.seoSettings.googleSiteVerification.trim());
  }
  const gaId = options?.seoSettings?.googleAnalyticsId?.trim();
  if (gaId && /^(G|GT|AW|UA)-[A-Z0-9-]+$/i.test(gaId) && !document.getElementById('directstay-ga4-loader')) {
    const gaScript = document.createElement('script');
    gaScript.id = 'directstay-ga4-loader';
    gaScript.async = true;
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(gaScript);
    const gaInline = document.createElement('script');
    gaInline.id = 'directstay-ga4-init';
    gaInline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
    document.head.appendChild(gaInline);
  }

  // Structured Data JSON-LD (SoftwareApplication, Organization, FAQ, Article, Breadcrumbs)
  const jsonLdObj = buildStructuredDataJsonLd(pageKey, options);
  let scriptEl = document.getElementById('directstay-jsonld') as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = 'directstay-jsonld';
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }
  scriptEl.textContent = JSON.stringify(jsonLdObj);
}

export type SeoConversionEventName =
  | 'landing_page_view'
  | 'trial_cta_click'
  | 'trial_registration'
  | 'demo_booking'
  | 'whatsapp_click'
  | 'pricing_page_view'
  | 'checkout_start'
  | 'subscription_purchase'
  | 'contact_form_submission';

export type LeadAcquisitionSource = 'Meta Ads' | 'Google' | 'Organic' | 'Direct' | 'WhatsApp' | 'Calendly';

export function detectLeadSource(): LeadAcquisitionSource {
  if (typeof window === 'undefined') return 'Direct';
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = (params.get('utm_source') || '').toLowerCase();
    const fbclid = params.get('fbclid');
    const gclid = params.get('gclid');
    if (fbclid || utmSource.includes('meta') || utmSource.includes('facebook') || utmSource.includes('instagram') || utmSource.includes('fb') || utmSource.includes('ig')) {
      sessionStorage.setItem('pms_lead_source', 'Meta Ads');
      return 'Meta Ads';
    }
    if (gclid || utmSource.includes('google') || utmSource.includes('adwords')) {
      sessionStorage.setItem('pms_lead_source', 'Google');
      return 'Google';
    }
    if (utmSource.includes('whatsapp')) {
      sessionStorage.setItem('pms_lead_source', 'WhatsApp');
      return 'WhatsApp';
    }
    if (utmSource.includes('calendly')) {
      sessionStorage.setItem('pms_lead_source', 'Calendly');
      return 'Calendly';
    }
    const cached = sessionStorage.getItem('pms_lead_source') as LeadAcquisitionSource | null;
    if (cached) return cached;
    if (document.referrer) {
      const ref = document.referrer.toLowerCase();
      if (ref.includes('facebook.com') || ref.includes('instagram.com') || ref.includes('fb.com')) return 'Meta Ads';
      if (ref.includes('google.') || ref.includes('bing.') || ref.includes('yahoo.')) return 'Organic';
    }
  } catch {
    // ignore
  }
  return 'Direct';
}

export interface LoggedConversionEvent {
  id: string;
  eventName: SeoConversionEventName;
  leadSource: LeadAcquisitionSource;
  plan?: string;
  value?: number;
  pagePath: string;
  timestamp: string;
}

export function getConversionEventsLog(): LoggedConversionEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('pms_conversion_events_log');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Fires Google Analytics 4 (gtag / dataLayer) and Meta Pixel (fbq) conversion events
 * Strictly excludes any sensitive customer PII (passwords, phone numbers, emails, Aadhaar, etc.)
 * Includes deduplication so completed conversions fire once per unique dedupeKey.
 */
export function trackSeoConversionEvent(
  eventName: SeoConversionEventName,
  metadata?: {
    plan?: string;
    roomTier?: string;
    value?: number;
    currency?: string;
    pagePath?: string;
    dedupeKey?: string;
    leadSource?: LeadAcquisitionSource;
  }
) {
  if (typeof window === 'undefined') return;

  // Deduplication check for completed conversion events
  if (metadata?.dedupeKey) {
    try {
      const dedupeStorageKey = `pms_conv_dedupe_${eventName}_${metadata.dedupeKey}`;
      if (sessionStorage.getItem(dedupeStorageKey)) {
        return;
      }
      sessionStorage.setItem(dedupeStorageKey, '1');
    } catch {
      // ignore storage errors
    }
  }

  const leadSource = metadata?.leadSource || detectLeadSource();
  const safePayload = {
    event_category: 'DirectStay_PMS_Conversion',
    lead_source: leadSource,
    plan: metadata?.plan || undefined,
    room_tier: metadata?.roomTier || undefined,
    value: typeof metadata?.value === 'number' ? metadata.value : undefined,
    currency: metadata?.currency || 'INR',
    page_path: metadata?.pagePath || window.location.pathname,
    timestamp: new Date().toISOString(),
  };

  try {
    // Save anonymized conversion telemetry for Salesperson Campaign Analytics
    const existingLog = getConversionEventsLog();
    const newEntry: LoggedConversionEvent = {
      id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      eventName,
      leadSource,
      plan: metadata?.plan,
      value: metadata?.value,
      pagePath: safePayload.page_path,
      timestamp: safePayload.timestamp,
    };
    localStorage.setItem('pms_conversion_events_log', JSON.stringify([newEntry, ...existingLog].slice(0, 500)));

    const win = window as any;
    win.dataLayer = win.dataLayer || [];
    win.dataLayer.push({
      event: eventName,
      ...safePayload,
    });

    if (typeof win.gtag === 'function') {
      win.gtag('event', eventName, safePayload);
    }

    if (typeof win.fbq === 'function') {
      if (eventName === 'landing_page_view') {
        win.fbq('track', 'PageView');
      } else if (eventName === 'trial_registration') {
        win.fbq('track', 'StartTrial', { currency: 'INR', value: 0 });
      } else if (eventName === 'checkout_start') {
        win.fbq('track', 'InitiateCheckout', { currency: 'INR', value: metadata?.value || 0 });
      } else if (eventName === 'subscription_purchase') {
        win.fbq('track', 'Purchase', {
          currency: 'INR',
          value: metadata?.value || 1899,
        });
      } else if (eventName === 'demo_booking' || eventName === 'contact_form_submission') {
        win.fbq('track', 'Lead', { content_name: eventName });
      } else {
        win.fbq('trackCustom', eventName, safePayload);
      }
    }

    window.dispatchEvent(
      new CustomEvent('directstay:seo_event', {
        detail: { eventName, ...safePayload },
      })
    );
  } catch {
    // Non-blocking analytics helper
  }
}

export interface HotelierGuideArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  readTime: string;
  relatedPage: PublicSeoPageKey;
  relatedLabel: string;
  content: string[];
}

export const SEO_HOTELIER_GUIDES: HotelierGuideArticle[] = [
  {
    id: 'guide-1',
    slug: 'what-is-a-hotel-pms-and-how-does-it-work',
    title: 'What Is a Hotel PMS and How Does It Work?',
    summary:
      'Understand how a cloud-based Hotel Property Management System centralizes reservations, front desk check-ins, housekeeping, and GST billing.',
    readTime: '4 min read',
    relatedPage: 'features',
    relatedLabel: 'Explore Hotel PMS Features',
    content: [
      'A Hotel Property Management System (PMS) is the operational backbone of a modern hotel, resort, or guest house. Instead of maintaining paper registers and disconnected spreadsheets, a PMS unifies room availability, guest reservations, check-in records, housekeeping status, and billing into one real-time dashboard.',
      'When a guest books a room or walks into the reception desk, DirectStay PMS checks live room inventory, captures government ID proof for the Guest Registration Card (GRC), assigns the room, and opens a live stay folio.',
      'Throughout the stay, restaurant POS orders, extra bed or extra person charges, laundry, and optional hotel services automatically sync to the guest folio so check-out billing takes seconds rather than minutes.',
    ],
  },
  {
    id: 'guide-2',
    slug: 'how-to-choose-hotel-management-software-in-india',
    title: 'How to Choose Hotel Management Software in India',
    summary:
      'Key criteria for Indian hotel owners: GST-compliant invoicing, Aadhaar/ID archival, multi-role staff permissions, and transparent pricing.',
    readTime: '5 min read',
    relatedPage: 'pricing',
    relatedLabel: 'Compare Hotel PMS Pricing',
    content: [
      'Selecting hotel management software in India requires attention to local compliance and practical front-desk workflows. First, verify that the billing engine supports configurable GST slabs (CGST and SGST), B2B GSTIN invoices, and instant PDF receipts.',
      'Second, ensure the system supports digital Guest Registration Cards (GRC) with Aadhaar, Passport, or Voter ID uploads and companion guest tracking.',
      'Finally, choose a cloud PMS like DirectStay that offers a genuine 7-day free trial and clear, flat-rate subscription tiers without hidden per-booking commissions.',
    ],
  },
  {
    id: 'guide-3',
    slug: 'hotel-pms-vs-manual-hotel-management',
    title: 'Hotel PMS vs Manual Hotel Management',
    summary:
      'Why switching from manual registers and Excel sheets to an automated hotel PMS eliminates double bookings and revenue leakage.',
    readTime: '4 min read',
    relatedPage: 'free-trial',
    relatedLabel: 'Start 7-Day Free Trial',
    content: [
      'Manual hotel registers often lead to overbookings, unbilled food or laundry orders, and hours spent reconciling cash handovers at shift change.',
      'With DirectStay PMS, room status transitions automatically from Available to Occupied at check-in and queues housekeeping upon check-out. Every advance payment, POS bill, and expense voucher is logged with a complete audit trail.',
    ],
  },
  {
    id: 'guide-4',
    slug: 'how-to-manage-hotel-reservations-efficiently',
    title: 'How to Manage Hotel Reservations Efficiently',
    summary:
      'Best practices for handling advance bookings, walk-in guests, room allocation, and date-wise availability calendars.',
    readTime: '4 min read',
    relatedPage: 'hotel-reservation-software',
    relatedLabel: 'View Hotel Reservation Software',
    content: [
      'Efficient reservation management starts with a live room availability calendar that shows confirmed bookings, in-house stays, and available rooms across every room category.',
      'DirectStay Hotel Reservation Software lets front-desk teams record advance deposits, assign or upgrade rooms, and convert confirmed reservations into checked-in stays with a single click.',
    ],
  },
  {
    id: 'guide-5',
    slug: 'essential-features-of-hotel-billing-software',
    title: 'Essential Features of Hotel Billing Software',
    summary:
      'How automated folio calculation, split payments, extra person/bed rules, and GST tax invoices speed up guest check-outs.',
    readTime: '4 min read',
    relatedPage: 'hotel-billing-software',
    relatedLabel: 'View Hotel Billing Software',
    content: [
      'Guest check-out is often the busiest moment at the front desk. A dedicated hotel billing software automatically combines room tariff, extra person charges beyond base occupancy, extra beds, POS food orders, and optional services into one accurate invoice.',
      'DirectStay PMS allows receptionists and admins to review bill adjustments, apply discounts, record Cash/UPI/Card settlements, and print or download GST-compliant invoices immediately.',
    ],
  },
  {
    id: 'guide-6',
    slug: 'how-hotel-software-helps-manage-daily-operations',
    title: 'How Hotel Software Helps Manage Daily Operations',
    summary:
      'Coordinate front desk, housekeeping, room inspections, petty cash, and owner financial reports from a single cloud platform.',
    readTime: '4 min read',
    relatedPage: 'features',
    relatedLabel: 'Explore All PMS Modules',
    content: [
      'Daily hotel operations involve multiple departments working together: reception handles arrivals and departures, housekeeping cleans and inspects rooms, kitchen staff fulfill POS orders, and accounts track daily closings.',
      'DirectStay connects all of these workflows in real time with role-based logins for Hotel Owners, Admins, Managers, Receptionists, Accountants, and Housekeeping staff.',
    ],
  },
  {
    id: 'guide-7',
    slug: 'hotel-pms-pricing-what-should-hotel-owners-consider',
    title: 'Hotel PMS Pricing: What Should Hotel Owners Consider?',
    summary:
      'How to evaluate monthly vs annual PMS subscriptions, room tier limits, support, and return on investment.',
    readTime: '3 min read',
    relatedPage: 'pricing',
    relatedLabel: 'See DirectStay Pricing Plans',
    content: [
      'When comparing hotel PMS pricing, look for transparent plans that include all core modules—reservations, check-in, billing, POS, housekeeping, and reports—without charging extra for each module.',
      'DirectStay offers a 7-Day Free Trial (₹0), Monthly Plan (₹1,899/month + GST), 6-Month Plan (₹7,999/6 months + GST), and 1-Year Enterprise Plan (₹14,000/year + GST).',
    ],
  },
  {
    id: 'guide-8',
    slug: 'how-to-set-up-a-hotel-property-management-system',
    title: 'How to Set Up a Hotel Property Management System',
    summary:
      'Step-by-step onboarding guide: configure hotel details, GSTIN, room categories, base/max occupancy, and staff accounts in minutes.',
    readTime: '4 min read',
    relatedPage: 'free-trial',
    relatedLabel: 'Start Your 7-Day Free Trial',
    content: [
      'Setting up DirectStay PMS takes only a few minutes. Start by registering your property name, contact details, GSTIN, and admin credentials in the self-service onboarding wizard.',
      'Once approved, add your room categories and room numbers, set base occupancy, max occupancy, and extra person charges, and start recording reservations and walk-in check-ins right away.',
    ],
  },
];

export function isCmsItemPublished(item: {
  published?: boolean;
  status?: 'draft' | 'scheduled' | 'published';
  scheduledAt?: string;
}): boolean {
  const status = item?.status || (item?.published ? 'published' : 'draft');
  if (status === 'published') return true;
  if (status === 'scheduled' && item?.scheduledAt) {
    const ts = new Date(item.scheduledAt).getTime();
    return !Number.isNaN(ts) && ts <= Date.now();
  }
  return false;
}

export function findMatchingSeoRedirect(
  pathname: string,
  redirects?: Array<{ fromPath: string; toPath: string; statusCode?: 301 | 302; isActive?: boolean }>
): { toPath: string; statusCode: 301 | 302 } | null {
  if (!Array.isArray(redirects) || redirects.length === 0) return null;
  const norm = String(pathname || '/').trim().toLowerCase().replace(/\/+$/, '') || '/';
  const match = redirects.find((r) => {
    if (!r || r.isActive === false || !r.fromPath || !r.toPath) return false;
    const fromNorm = String(r.fromPath).trim().toLowerCase().replace(/\/+$/, '') || '/';
    return fromNorm === norm;
  });
  if (!match) return null;
  return {
    toPath: String(match.toPath).trim(),
    statusCode: match.statusCode === 302 ? 302 : 301,
  };
}

export interface SeoAuditIssue {
  id: string;
  severity: 'error' | 'warning' | 'pass';
  area: 'Meta & Title' | 'Slug & Links' | 'Images & Alt' | 'Indexing & Analytics';
  target: string;
  message: string;
}

export function runSiteSeoAudit(params: {
  systemWebsite?: any;
  customPages?: any[];
}): { score: number; issues: SeoAuditIssue[]; brokenLinks: Array<{ source: string; href: string }> } {
  const issues: SeoAuditIssue[] = [];
  const brokenLinks: Array<{ source: string; href: string }> = [];
  const seo = params.systemWebsite?.seoSettings || {};
  const pages: any[] = Array.isArray(params.customPages) ? params.customPages : [];
  const blogs: any[] = Array.isArray(params.systemWebsite?.blogs) ? params.systemWebsite.blogs : [];

  // 1. Global GSC / GA4 / Robots / Sitemap checks
  if (!seo.googleSiteVerification) {
    issues.push({
      id: 'gsc-missing',
      severity: 'warning',
      area: 'Indexing & Analytics',
      target: 'Google Search Console',
      message: 'Google Search Console verification token is not configured yet.',
    });
  } else {
    issues.push({
      id: 'gsc-ok',
      severity: 'pass',
      area: 'Indexing & Analytics',
      target: 'Google Search Console',
      message: 'Google Search Console verification meta tag is configured.',
    });
  }

  if (!seo.googleAnalyticsId) {
    issues.push({
      id: 'ga4-missing',
      severity: 'warning',
      area: 'Indexing & Analytics',
      target: 'Google Analytics (GA4)',
      message: 'GA4 Measurement ID (G-XXXXXXXXXX) is not set.',
    });
  } else {
    issues.push({
      id: 'ga4-ok',
      severity: 'pass',
      area: 'Indexing & Analytics',
      target: 'Google Analytics (GA4)',
      message: `GA4 tracking active (${seo.googleAnalyticsId}).`,
    });
  }

  // 2. Build known valid internal routes for broken-link checks
  const validInternalPaths = new Set<string>([
    '/',
    '/features',
    '/gallery',
    '/pricing',
    '/free-trial',
    '/about',
    '/contact',
    '/blog',
    '/login',
    '/privacy-policy',
    '/terms-and-conditions',
    '/refund-policy',
    '/hotel-reservation-software',
    '/hotel-billing-software',
  ]);

  const seenSlugs = new Map<string, string>();

  const checkHtmlLinks = (sourceLabel: string, html: string) => {
    const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = hrefRegex.exec(html || '')) !== null) {
      const href = String(m[1] || '').trim();
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('https://wa.me')) {
        continue;
      }
      if (href.startsWith('/')) {
        const clean = href.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        if (!validInternalPaths.has(clean)) {
          brokenLinks.push({ source: sourceLabel, href });
        }
      } else if (!/^https?:\/\//i.test(href)) {
        brokenLinks.push({ source: sourceLabel, href });
      }
    }
  };

  pages.forEach((p) => {
    if (!p) return;
    const slug = String(p.slug || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    if (slug) {
      validInternalPaths.add(`/page/${slug}`);
      if (seenSlugs.has(`page:${slug}`)) {
        issues.push({
          id: `dup-page-${p.id}`,
          severity: 'error',
          area: 'Slug & Links',
          target: `Page: ${p.title}`,
          message: `Duplicate page slug "/page/${slug}" conflicts with "${seenSlugs.get(`page:${slug}`)}".`,
        });
      } else {
        seenSlugs.set(`page:${slug}`, p.title || p.id);
      }
    } else {
      issues.push({
        id: `empty-slug-${p.id}`,
        severity: 'error',
        area: 'Slug & Links',
        target: `Page: ${p.title}`,
        message: 'Custom URL slug is missing.',
      });
    }
  });

  blogs.forEach((b) => {
    if (!b) return;
    const slug = String(b.slug || b.id || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    if (slug) {
      validInternalPaths.add(`/blog/${slug}`);
      if (seenSlugs.has(`blog:${slug}`)) {
        issues.push({
          id: `dup-blog-${b.id}`,
          severity: 'error',
          area: 'Slug & Links',
          target: `Blog: ${b.title}`,
          message: `Duplicate blog slug "/blog/${slug}" conflicts with "${seenSlugs.get(`blog:${slug}`)}".`,
        });
      } else {
        seenSlugs.set(`blog:${slug}`, b.title || b.id);
      }
    }
  });

  // 3. Audit each page & blog for SEO title, meta description, image alt, and broken internal links
  const auditDoc = (kind: 'Page' | 'Blog', item: any) => {
    const label = `${kind}: ${item.title || item.id}`;
    const title = String(item.seo?.seoTitle || item.title || '').trim();
    const desc = String(item.seo?.metaDescription || item.summary || '').trim();
    if (title.length < 15) {
      issues.push({
        id: `short-title-${item.id}`,
        severity: 'warning',
        area: 'Meta & Title',
        target: label,
        message: `SEO title is short (${title.length} chars; recommended 35–60 chars).`,
      });
    } else if (title.length > 65) {
      issues.push({
        id: `long-title-${item.id}`,
        severity: 'warning',
        area: 'Meta & Title',
        target: label,
        message: `SEO title exceeds 65 chars (${title.length} chars) and may truncate in Google search.`,
      });
    }
    if (!desc || desc.length < 50) {
      issues.push({
        id: `short-desc-${item.id}`,
        severity: 'warning',
        area: 'Meta & Title',
        target: label,
        message: `Meta description is missing or short (${desc.length} chars; recommended 110–160 chars).`,
      });
    }
    const imgUrl = item.featuredImageUrl || item.imageUrl;
    const imgAlt = item.featuredImageAlt || item.seo?.imageAlt;
    if (imgUrl && !String(imgAlt || '').trim()) {
      issues.push({
        id: `missing-alt-${item.id}`,
        severity: 'warning',
        area: 'Images & Alt',
        target: label,
        message: 'Featured image is missing SEO alt text.',
      });
    }
    checkHtmlLinks(label, String(item.content || ''));
  };

  pages.forEach((p) => p && auditDoc('Page', p));
  blogs.forEach((b) => b && auditDoc('Blog', b));

  // Check Header/Footer nav links for broken internal URLs
  const navLinks = [
    ...(Array.isArray(params.systemWebsite?.headerNavLinks) ? params.systemWebsite.headerNavLinks : []),
    ...(Array.isArray(params.systemWebsite?.footerNavLinks) ? params.systemWebsite.footerNavLinks : []),
  ];
  navLinks.forEach((nav: any) => {
    const href = String(nav?.href || '').trim();
    if (href.startsWith('/') && !href.startsWith('/#')) {
      const clean = href.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
      if (!validInternalPaths.has(clean)) {
        brokenLinks.push({ source: `Nav Link: ${nav.label || href}`, href });
      }
    }
  });

  brokenLinks.forEach((bl, i) => {
    issues.push({
      id: `broken-link-${i}`,
      severity: 'error',
      area: 'Slug & Links',
      target: bl.source,
      message: `Broken or unregistered link detected: "${bl.href}".`,
    });
  });

  if (brokenLinks.length === 0) {
    issues.push({
      id: 'links-ok',
      severity: 'pass',
      area: 'Slug & Links',
      target: 'Internal Link Health',
      message: 'Zero broken internal links detected across CMS pages, blogs, and navigation menus.',
    });
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warning').length;
  const score = Math.max(10, Math.min(100, 100 - errorCount * 15 - warnCount * 6));

  return { score, issues, brokenLinks };
}
