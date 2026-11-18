import fs from 'fs';
import path from 'path';

const mode = process.argv[2] || 'post';
const rootDir = process.cwd();
const DOMAIN = 'https://directstay.online';

const SEO_ROUTES = [
  {
    slug: '',
    title: 'Hotel Management Software & PMS for Hotels | DirectStay',
    description:
      'Manage hotel reservations, room inventory, check-ins, billing and reports with DirectStay PMS. Start your 7-day free trial today.',
    keywords:
      'Hotel Management Software, Hotel PMS Software, Property Management System for Hotels, Hotel Reservation Software, Hotel Billing Software, Hotel Front Desk Software, Hotel Room Management Software, Hotel Booking Management System, Cloud-Based Hotel Management Software',
    canonical: `${DOMAIN}/`,
    breadcrumb: 'Home',
  },
  {
    slug: 'features',
    title: 'Hotel PMS Features for Modern Hotels | DirectStay',
    description:
      'Explore DirectStay PMS features for hotel reservations, room management, check-ins, billing, invoicing and reports in one platform.',
    keywords:
      'Hotel PMS Features, Hotel Management Software Features, Hotel Front Desk Features, Hotel Room Management, Hotel POS & Billing Features',
    canonical: `${DOMAIN}/features/`,
    breadcrumb: 'Features',
  },
  {
    slug: 'pricing',
    title: 'Hotel Management Software Pricing | DirectStay PMS',
    description:
      'Explore DirectStay PMS pricing plans for hotels. Compare features, choose the right subscription and start your 7-day free trial.',
    keywords:
      'Hotel Management Software Pricing, Hotel PMS Pricing India, Cloud Hotel PMS Subscription, Hotel Software Cost',
    canonical: `${DOMAIN}/pricing/`,
    breadcrumb: 'Pricing',
  },
  {
    slug: 'free-trial',
    title: 'Try Hotel Management Software Free for 7 Days | DirectStay',
    description:
      'Try DirectStay hotel management software free for 7 days. Explore hotel operations, reservations, billing and reporting before subscribing.',
    keywords:
      'Free Hotel Management Software Trial, 7-Day Free Hotel PMS Trial, Try Hotel PMS Free, Hotel Software Evaluation',
    canonical: `${DOMAIN}/free-trial/`,
    breadcrumb: '7-Day Free Trial',
  },
  {
    slug: 'hotel-reservation-software',
    title: 'Hotel Reservation Management Software | DirectStay',
    description:
      'Manage hotel reservations, room availability and booking records with DirectStay PMS. Simplify reservation management for your hotel.',
    keywords:
      'Hotel Reservation Software, Hotel Booking Management System, Room Availability Software, Walk-In Check-In Software',
    canonical: `${DOMAIN}/hotel-reservation-software/`,
    breadcrumb: 'Hotel Reservation Software',
  },
  {
    slug: 'hotel-billing-software',
    title: 'Hotel Billing and Invoice Software | DirectStay PMS',
    description:
      'Simplify hotel billing, guest invoices and payment records with DirectStay PMS. Manage daily hotel billing from one platform.',
    keywords:
      'Hotel Billing Software, GST Hotel Invoice Software, Hotel Folio Billing System, Restaurant POS Hotel Billing',
    canonical: `${DOMAIN}/hotel-billing-software/`,
    breadcrumb: 'Hotel Billing Software',
  },
  {
    slug: 'about',
    title: 'About DirectStay | Hotel Management Software',
    description:
      'Learn about DirectStay PMS and our mission to help hotels simplify reservations, billing and everyday hotel operations.',
    keywords:
      'About DirectStay PMS, Commission-Free Hotel Software, Hospitality SaaS India, DirectStay Mission',
    canonical: `${DOMAIN}/about/`,
    breadcrumb: 'About Us',
  },
  {
    slug: 'contact',
    title: 'Contact DirectStay PMS | Hotel Software Demo and Support',
    description:
      'Contact DirectStay PMS for product demonstrations, subscription enquiries, onboarding and hotel management software support.',
    keywords:
      'Contact DirectStay PMS, Book Hotel PMS Demo, Hotel Software Support India, DirectStay Onboarding',
    canonical: `${DOMAIN}/contact/`,
    breadcrumb: 'Contact Us',
  },
  {
    slug: 'gallery',
    title: 'Hotel PMS Admin Panel Screenshots & Product Demo Gallery | DirectStay',
    description:
      'Explore real screenshots and interactive product walkthroughs of the DirectStay PMS Admin Panel: Live Room Rack, Front Desk Check-In, GST Billing, Restaurant POS, and Finance Hub.',
    keywords:
      'Hotel PMS Admin Panel Demo, Hotel Software Screenshots, DirectStay Gallery, Hotel Billing POS Demo',
    canonical: `${DOMAIN}/gallery/`,
    breadcrumb: 'Product Gallery & Demo',
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy | DirectStay Hotel Management Software (PMS)',
    description:
      'Read the DirectStay PMS Privacy Policy covering hotel tenant data isolation, guest GRC document privacy, DPDP Act 2023 compliance, and cloud encryption.',
    keywords:
      'DirectStay Privacy Policy, Hotel Guest Data Privacy, DPDP Act 2023 Compliance',
    canonical: `${DOMAIN}/privacy-policy/`,
    breadcrumb: 'Privacy Policy',
  },
  {
    slug: 'terms-and-conditions',
    title: 'Terms & Conditions | DirectStay Hotel Management Software (PMS)',
    description:
      'Review the Terms & Conditions for DirectStay PMS SaaS subscriptions, 7-day free trial usage, GST billing compliance, and hotel data ownership.',
    keywords:
      'DirectStay Terms and Conditions, Hotel PMS SaaS Agreement, DirectStay Subscription Terms',
    canonical: `${DOMAIN}/terms-and-conditions/`,
    breadcrumb: 'Terms & Conditions',
  },
  {
    slug: 'refund-policy',
    title: 'Refund & Cancellation Policy | DirectStay PMS',
    description:
      'Transparent Refund & Cancellation Policy for DirectStay PMS 7-day free trials, monthly packs, annual subscriptions, and data export guarantees.',
    keywords:
      'DirectStay Refund Policy, Hotel PMS Cancellation Policy, 7-Day Free Trial Terms',
    canonical: `${DOMAIN}/refund-policy/`,
    breadcrumb: 'Refund & Cancellation Policy',
  },
  {
    slug: 'data-security',
    title: 'Data Security & Multi-Tenant Cloud Isolation | DirectStay PMS',
    description:
      'Learn how DirectStay PMS protects your hotel rooms, financial ledgers, and guest records with strict multi-tenant isolation, RBAC, and immutable audit logs.',
    keywords:
      'Hotel PMS Data Security, Multi-Tenant Hotel Cloud Security, Role-Based Access Control PMS',
    canonical: `${DOMAIN}/data-security/`,
    breadcrumb: 'Data Security & Isolation',
  },
  {
    slug: 'prototype',
    title: 'Hotel Management Software & PMS for Hotels | DirectStay Prototype',
    description:
      'Manage hotel reservations, room inventory, check-ins, billing and reports with DirectStay PMS. Start your 7-day free trial today.',
    keywords:
      'Hotel Management Software, Hotel PMS Software, DirectStay Prototype',
    canonical: `${DOMAIN}/prototype/`,
    breadcrumb: 'Prototype',
  },
  {
    slug: 'blog',
    title: 'Hospitality & Hotel Tech Blog | DirectStay Hotel PMS Guides',
    description:
      'Read expert hospitality guides, hotel GST billing tips, direct booking growth strategies, and front-desk automation best practices from DirectStay PMS.',
    keywords:
      'Hotel Management Blog, Hotel PMS Guides, Hotel GST Invoicing Tips, Direct Hotel Booking Strategies, Front Desk Automation Advice',
    canonical: `${DOMAIN}/blog/`,
    breadcrumb: 'Blog',
  },
  {
    slug: 'blog/cloud-hotel-pms-speeds-up-guest-check-ins',
    title: 'How Cloud Hotel PMS Eliminates Front-Desk Errors & Speeds Up Guest Check-Ins | DirectStay PMS',
    description:
      'Discover how switching from manual registers and spreadsheets to a unified cloud PMS cuts check-in time under 60 seconds with digital Aadhaar GRC archival and real-time room status.',
    keywords:
      'Cloud Hotel PMS, Hotel Check-In Software, Digital GRC Card, Fast Hotel Reception Check-In',
    canonical: `${DOMAIN}/blog/cloud-hotel-pms-speeds-up-guest-check-ins/`,
    breadcrumb: 'How Cloud Hotel PMS Eliminates Front-Desk Errors',
    isArticle: true,
    author: 'DirectStay Hospitality Desk',
    datePublished: '2026-10-28',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
  },
  {
    slug: 'blog/guide-to-gst-hotel-billing-and-split-settlements',
    title: 'Complete Guide to 5% GST Hotel Billing, Split Settlements & B2B Corporate Invoices | DirectStay PMS',
    description:
      'Learn how to automate CGST + SGST calculations, consolidate Restaurant POS and laundry charges into a single room folio, and settle bills across UPI, Card, and Cash effortlessly.',
    keywords:
      'Hotel GST Billing, Split Payment Hotel Invoice, Restaurant POS Folio, Hotel Bill GST Calculation',
    canonical: `${DOMAIN}/blog/guide-to-gst-hotel-billing-and-split-settlements/`,
    breadcrumb: 'Complete Guide to 5% GST Hotel Billing',
    isArticle: true,
    author: 'DirectStay Finance Team',
    datePublished: '2026-11-01',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&auto=format&fit=crop&q=80',
  },
  {
    slug: 'blog/increase-direct-hotel-bookings-save-ota-commissions',
    title: '5 Proven Ways Boutique Hotels Can Increase Direct Bookings & Save OTA Commissions | DirectStay PMS',
    description:
      'Stop paying 18% to 25% commission on repeat guests. See how boutique properties use direct booking links, WhatsApp confirmations, and guest history registries to boost direct revenue.',
    keywords:
      'Increase Direct Hotel Bookings, Save OTA Commissions, Boutique Hotel Booking Engine, Hotel WhatsApp Booking',
    canonical: `${DOMAIN}/blog/increase-direct-hotel-bookings-save-ota-commissions/`,
    breadcrumb: '5 Ways Boutique Hotels Can Increase Direct Bookings',
    isArticle: true,
    author: 'DirectStay Growth Advisory',
    datePublished: '2026-11-03',
    image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&auto=format&fit=crop&q=80',
  },
];

function buildJsonLdForRoute(route) {
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${DOMAIN}/#organization`,
      name: 'DirectStay',
      legalName: 'DirectStay PMS',
      url: `${DOMAIN}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${DOMAIN}/favicon.svg`,
      },
      contactPoint: [
        {
          '@type': 'ContactPoint',
          telephone: '+91-97179-94695',
          email: 'directstay001@gmail.com',
          contactType: 'customer support',
          areaServed: 'IN',
          availableLanguage: ['English', 'Hindi'],
        },
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${DOMAIN}/#website`,
      url: `${DOMAIN}/`,
      name: 'DirectStay PMS',
      description:
        'Manage hotel reservations, room inventory, check-ins, billing and reports with DirectStay PMS. Start your 7-day free trial today.',
      publisher: {
        '@id': `${DOMAIN}/#organization`,
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${DOMAIN}/#software`,
      name: 'DirectStay PMS',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Hotel Property Management System (PMS)',
      operatingSystem: 'Web, Cloud-Based (Windows, macOS, Android, iOS browsers)',
      url: route.canonical,
      description: route.description,
      offers: [
        {
          '@type': 'Offer',
          name: '7-Day Free Trial',
          price: '0',
          priceCurrency: 'INR',
          description: '7-day full-feature hotel management software trial.',
          url: `${DOMAIN}/free-trial/`,
        },
        {
          '@type': 'Offer',
          name: 'Monthly Hotel PMS Subscription',
          price: '1899',
          priceCurrency: 'INR',
          description: 'Monthly hotel PMS subscription (plus 18% GST).',
          url: `${DOMAIN}/pricing/`,
        },
        {
          '@type': 'Offer',
          name: '6-Month Pro Pack Subscription',
          price: '7999',
          priceCurrency: 'INR',
          description: '6-month hotel PMS subscription (plus 18% GST).',
          url: `${DOMAIN}/pricing/`,
        },
        {
          '@type': 'Offer',
          name: 'Annual Enterprise Subscription',
          price: '17000',
          priceCurrency: 'INR',
          description: 'Annual hotel PMS subscription (plus 5% GST = ₹17,850 total).',
          url: `${DOMAIN}/pricing/`,
        },
      ],
    },
  ];

  if (route.isArticle) {
    graph.push({
      '@type': 'BlogPosting',
      '@id': `${route.canonical}#article`,
      isPartOf: {
        '@type': 'WebSite',
        '@id': `${DOMAIN}/#website`,
      },
      headline: route.title.replace(' | DirectStay PMS', ''),
      description: route.description,
      image: route.image || `${DOMAIN}/hero-resort.jpg`,
      datePublished: route.datePublished || '2026-10-28',
      author: {
        '@type': 'Person',
        name: route.author || 'DirectStay Hospitality Desk',
      },
      publisher: {
        '@id': `${DOMAIN}/#organization`,
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': route.canonical,
      },
    });

    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${route.canonical}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${DOMAIN}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Blog',
          item: `${DOMAIN}/blog/`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: route.breadcrumb,
          item: route.canonical,
        },
      ],
    });
  } else if (route.slug) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${route.canonical}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${DOMAIN}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: route.breadcrumb,
          item: route.canonical,
        },
      ],
    });
  }

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': graph,
  });
}

const homeRoute = SEO_ROUTES[0];

// Keep DEV_INDEX_HTML free of extra <link> tags so Vite's build-html plugin on Windows junctions does not fail
const DEV_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${homeRoute.title}</title>
    <meta name="description" content="${homeRoute.description}" />
    <meta name="keywords" content="${homeRoute.keywords}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

function injectFullSeoHeadIntoCompiledHtml(baseHtml, route) {
  let html = baseHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${route.title}</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${route.description}" />`
  );
  html = html.replace(
    /<meta name="keywords" content="[^"]*"\s*\/?>/,
    `<meta name="keywords" content="${route.keywords}" />`
  );

  // Remove any previously injected SEO block if re-running post
  html = html.replace(/<!-- DIRECTSTAY_SEO_START -->[\s\S]*?<!-- DIRECTSTAY_SEO_END -->\s*/g, '');

  const seoHeadBlock = `<!-- DIRECTSTAY_SEO_START -->
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <link rel="canonical" id="directstay-canonical-link" href="${route.canonical}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="DirectStay PMS" />
    <meta property="og:title" content="${route.title}" />
    <meta property="og:description" content="${route.description}" />
    <meta property="og:url" content="${route.canonical}" />
    <meta property="og:image" content="${DOMAIN}/hero-resort.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${route.title}" />
    <meta name="twitter:description" content="${route.description}" />
    <meta name="twitter:image" content="${DOMAIN}/hero-resort.jpg" />
    <script id="directstay-jsonld-schema" type="application/ld+json">${buildJsonLdForRoute(route)}</script>
    <!-- DIRECTSTAY_SEO_END -->`;

  html = html.replace('</head>', `    ${seoHeadBlock}\n  </head>`);
  return html;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function cleanOldBundles(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const file of fs.readdirSync(dirPath)) {
    if (file.startsWith('index-') && (file.endsWith('.js') || file.endsWith('.css'))) {
      try {
        fs.unlinkSync(path.join(dirPath, file));
      } catch {}
    }
  }
}

if (mode === 'pre') {
  cleanOldBundles(path.join(rootDir, 'public', 'assets'));
  cleanOldBundles(path.join(rootDir, 'assets'));
  cleanOldBundles(path.join(rootDir, 'dist', 'assets'));
  fs.writeFileSync(path.join(rootDir, 'index.html'), DEV_INDEX_HTML, 'utf8');
  console.log('Cleaned old asset bundles and restored SEO dev index.html for Vite build.');
} else if (mode === 'post') {
  const distIndex = path.join(rootDir, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    const rawCompiledHtml = fs.readFileSync(distIndex, 'utf8');
    const homeCompiledHtml = injectFullSeoHeadIntoCompiledHtml(rawCompiledHtml, homeRoute);
    fs.writeFileSync(distIndex, homeCompiledHtml, 'utf8');
    fs.writeFileSync(path.join(rootDir, 'index.html'), homeCompiledHtml, 'utf8');

    // Generate route-specific index.html for all 7 inner SEO routes in dist/<slug>/index.html and <slug>/index.html
    for (const route of SEO_ROUTES) {
      if (!route.slug) continue;
      const routeHtml = injectFullSeoHeadIntoCompiledHtml(rawCompiledHtml, route);
      const distRouteDir = path.join(rootDir, 'dist', route.slug);
      const rootRouteDir = path.join(rootDir, route.slug);
      fs.mkdirSync(distRouteDir, { recursive: true });
      fs.mkdirSync(rootRouteDir, { recursive: true });
      fs.writeFileSync(path.join(distRouteDir, 'index.html'), routeHtml, 'utf8');
      fs.writeFileSync(path.join(rootRouteDir, 'index.html'), routeHtml, 'utf8');
    }
  }

  copyDirRecursive(path.join(rootDir, 'dist', 'assets'), path.join(rootDir, 'assets'));
  copyDirRecursive(path.join(rootDir, 'dist', 'assets'), path.join(rootDir, 'public', 'assets'));
  copyDirRecursive(path.join(rootDir, 'dist', 'api'), path.join(rootDir, 'api'));
  copyDirRecursive(path.join(rootDir, 'dist', 'gallery'), path.join(rootDir, 'gallery'));

  for (const staticFile of ['hero-resort.jpg', 'sitemap.xml', 'robots.txt', 'favicon.svg']) {
    const srcFile = path.join(rootDir, 'dist', staticFile);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(rootDir, staticFile));
    }
  }

  const vercelConfig = JSON.stringify(
    {
      version: 2,
      buildCommand: '',
      outputDirectory: '.',
      framework: null,
      rewrites: [
        { source: '/api/:path*', destination: 'https://directstay.online/api/:path*' },
        { source: '/(.*)', destination: '/index.html' },
      ],
    },
    null,
    2
  );
  fs.writeFileSync(path.join(rootDir, 'dist', 'vercel.json'), vercelConfig, 'utf8');
  fs.writeFileSync(path.join(rootDir, 'vercel.json'), vercelConfig, 'utf8');
  fs.writeFileSync(
    path.join(rootDir, 'dist', '.vercelignore'),
    'server.cjs\nserver.cjs.map\n',
    'utf8'
  );

  console.log('Synced compiled dist/index.html, SEO route pages, sitemap.xml, robots.txt, assets/, and api/ to project root.');
}
