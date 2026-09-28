/**
 * Bot HTML for list hubs and static pages.
 *
 * /deals /brands /events /blog /categories /contact /support /privacy /terms
 * Each document has its own title, description, canonical, H1, and breadcrumbs.
 * Inventory hubs include a real item list. Never emit redemption codes.
 */
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function breadcrumbList(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

const SITE_URL = "https://www.unideals.co";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;
const FETCH_TIMEOUT_MS = 8000;

const OFFICIAL_CATEGORIES = [
  "Fashion",
  "Food & Drink",
  "Tech & Mobile",
  "Beauty & Care",
  "Learning",
  "Travel & Auto",
  "Health & Fitness",
  "Household",
  "Finance",
  "Events & Tickets",
];

const CATEGORY_DESCRIPTIONS = {
  Fashion:
    "Student discounts on clothing, shoes, and accessories from top fashion brands in Sri Lanka.",
  "Food & Drink":
    "Cheap eats, cafe deals, and restaurant discounts for university students across Sri Lanka.",
  "Tech & Mobile":
    "Student pricing on laptops, phones, accessories, and software in Sri Lanka.",
  "Beauty & Care":
    "Student discounts on skincare, haircare, and beauty essentials in Sri Lanka.",
  Learning:
    "Discounted courses, books, stationery, and learning tools for Sri Lankan students.",
  "Travel & Auto":
    "Student discounts on flights, transport, and auto services in Sri Lanka.",
  "Health & Fitness":
    "Gym memberships, wellness, and fitness discounts for verified university students.",
  Household:
    "Student discounts on home essentials and household goods in Sri Lanka.",
  Finance:
    "Student banking perks, financial tools, and money offers in Sri Lanka.",
  "Events & Tickets":
    "Discounted tickets and student offers for events and entertainment in Sri Lanka.",
};

const CONTACT_FAQS = [
  {
    question: "How do I verify my student status?",
    answer:
      "Sign up, then verify from Profile. A university email code verifies you immediately; otherwise upload a student ID. Status is valid for 12 months and must be renewed each year.",
  },
  {
    question: "Can I submit an event for my society?",
    answer:
      "Yes. Select Event Collaboration in the form or use the Events page to submit directly.",
  },
  {
    question: "Are partnerships paid?",
    answer:
      "We offer both free student discounts and premium featured placements. Reach out to learn more.",
  },
];

const SUPPORT_FAQS = [
  {
    question: "Is Uni Deals the same as UNiDAYS?",
    answer:
      "No. Uni Deals (unideals.co) is Sri Lanka's independent student deals platform. It is not UNiDAYS and is not the service at myunidays.com.",
  },
  {
    question: "How do I verify my student status?",
    answer:
      "Open Profile and complete verification. A correct code sent to your university email verifies you immediately. Gmail and school students upload a student ID for admin review. Verification is valid for 12 months.",
  },
  {
    question: "Do I need to verify every year?",
    answer:
      "Yes. Student status lasts 12 months from approval. Re-verify from Profile before it expires so you can keep unlocking deal codes and in-store tickets.",
  },
  {
    question: "How do I redeem a deal?",
    answer:
      "Open the deal. Online offers reveal a promo code. In-store offers generate a timed ticket on that deal page — show it to the cashier. Your Profile pass is identity only, not a ticket.",
  },
  {
    question: "How do I submit a campus event?",
    answer:
      "Sign in, go to Events, and submit a listing. Events stay pending until an admin approves them. Students will see approved events on the Events page.",
  },
  {
    question: "How do brand partnerships work?",
    answer:
      "Email unideals.lk@gmail.com or use the Contact form. A team member will reply from that inbox. Automated mail from Uni Deals is send-only and is not monitored.",
  },
];

const PRIVACY_SECTIONS = [
  ["1. Who We Are", "Uni Deals (unideals.co) is a student discount platform serving universities and partner businesses in Sri Lanka. Uni Deals is not UNiDAYS and is not affiliated with myunidays.com. This Privacy Policy explains how we collect, use, protect, and disclose personal information when you use our website, mobile app, and related services."],
  ["2. Age Requirement", "Uni Deals is not designed for children under 13. You must be at least 13 years old to create an account or use the service. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has created an account, contact us at unideals.lk@gmail.com and we will delete it."],
  ["3. Information We Collect", "We may collect account and profile data such as name, email address, user role, university-related verification details, usage events, and saved deal interactions. Partner and admin users may also provide business and offer-management details relevant to campaign publishing. If you verify with a student ID, we collect photos of that document. If you use the Uni Deals mobile app and enable notifications, we store a device push token. We do not collect payment card details on Uni Deals."],
  ["4. How We Use Your Data", "We use data to authenticate accounts, support student verification, assign and enforce role-based permissions, deliver relevant deals, prevent fraud, respond to support requests, send optional app notifications you enable, and improve service reliability and user experience."],
  ["5. Student ID Documents", "ID photos are stored in a private storage bucket. They are not public files. When an admin reviews a request, they open the images through short-lived signed URLs that expire after about five minutes. We retain ID documents only as long as needed to complete verification, prevent duplicate or fraudulent enrolments, and meet legal obligations, then we delete them with your account or earlier when they are no longer required."],
  ["6. Camera and Push Notifications", "Partner and admin users who scan in-store tickets may grant camera access on the partner scanner. Camera frames are processed on the device to read QR codes. We do not upload a live video stream of the scan. The mobile app may store Expo push tokens on your account so we can send optional deal or event alerts. You can disable notifications in the device settings. Tokens are removed when you delete your account."],
  ["7. Verification, Security, and Access Control", "Uni Deals uses safeguards such as authenticated sessions, role-based authorization, controlled data access paths, and verification checks to reduce unauthorized access. While no system can be guaranteed 100% secure, we apply industry-standard measures to protect data in transit and at rest through our infrastructure providers."],
  ["8. Third-Party Partners and Service Providers", "Deals shown on Uni Deals are provided by third-party partners. We may share only the minimum necessary information with trusted service providers and infrastructure vendors for hosting, authentication, analytics, and communications. Partner businesses are independently responsible for how they handle transactions and redemptions under their own policies."],
  ["9. Data Retention", "We retain personal data only for as long as needed to provide the service, meet legal and compliance obligations, resolve disputes, and enforce platform terms. Retention periods may vary by data type and operational necessity. When you delete your account we remove the records described in Your Rights."],
  ["10. Cookies and Similar Technologies", "We may use cookies or similar technologies for login persistence, security, and analytics. On the live site we use Google Analytics 4 and Microsoft Clarity to understand how pages are used. Clarity session recordings mask typed input, including student emails and registration IDs. You can manage browser preferences, but disabling certain cookies may affect platform functionality."],
  ["11. Your Rights", "Subject to applicable law, including the Sri Lankan Personal Data Protection Act where applicable, you may request access or correction of your personal information. You can delete your Uni Deals account yourself at any time at https://www.unideals.co/delete-account. You do not need to email support to close an account. For other privacy questions, contact unideals.lk@gmail.com."],
  ["12. International Transfers", "Our technology providers may process data in multiple jurisdictions. Where cross-border transfer occurs, we apply appropriate safeguards and contractual protections consistent with applicable legal requirements."],
  ["13. Contact", "For privacy questions or requests, contact unideals.lk@gmail.com."],
];

const TERMS_SECTIONS = [
  ["1. Agreement and Scope", "These Terms of Service govern your access to and use of Uni Deals, a software platform that connects verified students with promotions published by third-party merchants and institutional partners in Sri Lanka. By creating an account, browsing deals, or using any Uni Deals website or app feature, you agree to these Terms."],
  ["2. Eligibility and Accounts", "You must be at least 13 years old. Uni Deals is not designed for children under 13. You must provide accurate account information and maintain the security of your login credentials. Student eligibility requires verification of enrolment (university email OTP and/or student ID). Verified student status is valid for 12 months from verification and must be renewed each year to keep unlocking partner offers. Uni Deals uses role-based access controls, including student, partner, and administrator roles."],
  ["3. Partner-Provided Offers", "Discounts, redemption terms, inventory, and fulfillment are provided and managed by third-party partners. Uni Deals acts as a discovery and access layer and does not own, manufacture, or fulfill partner products and services. Partners remain responsible for the accuracy, legality, availability, and execution of their offers."],
  ["4. Acceptable Use", "You agree not to abuse the platform, attempt unauthorized access, scrape private data, share restricted redemption codes, impersonate another user, or interfere with platform security controls. We may suspend or terminate accounts involved in fraud, abuse, or any activity that risks students, partners, or platform stability."],
  ["5. Device Permissions", "Partners who redeem in-store offers may be asked for camera access so the scanner can read student QR tickets on the device. Students who use the Uni Deals mobile app may be asked for notification permission so we can send optional deal or event alerts. You can refuse or revoke those permissions in your device settings."],
  ["6. Privacy and Data Protection", "Uni Deals applies reasonable technical and organizational safeguards for personal data, including account authentication, email verification checks, and role-based authorization. Student ID photos are stored privately and shown to reviewers through short-lived signed URLs. Our data handling practices are described in the Privacy Policy and align with applicable Sri Lankan data protection obligations, including the Personal Data Protection Act, where applicable."],
  ["7. Account Deletion", "You may delete your account at any time at https://www.unideals.co/delete-account. Deletion is permanent. It removes your login and associated personal records as described in the Privacy Policy. Offers you already redeemed with a partner remain subject to that partner's own terms."],
  ["8. Intellectual Property", "Uni Deals branding, software, and platform content are protected by intellectual property laws. Partner logos, brand assets, and offer content remain the property of their respective owners and are displayed under applicable permissions."],
  ["9. Service Availability and Changes", "We may update, suspend, or discontinue features to improve reliability, security, or legal compliance. We do not guarantee uninterrupted access at all times, and maintenance or third-party dependencies may affect availability."],
  ["10. Disclaimers and Liability Limits", "The platform is provided on an as is and as available basis. To the extent permitted by law, Uni Deals is not liable for indirect, incidental, or consequential losses arising from partner actions, offer changes, delays, or service interruptions."],
  ["11. Governing Law", "These Terms are governed by the laws of Sri Lanka. Any dispute relating to the platform will be subject to the applicable courts and legal procedures of Sri Lanka, unless otherwise required by law."],
  ["12. Contact", "For legal, compliance, or account concerns, contact the Uni Deals team at unideals.lk@gmail.com."],
];

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchJson(url, options) {
  const timeout = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: timeout.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  } finally {
    timeout.clear();
  }
}

async function fetchPublicDeals(supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) return [];
  return fetchJson(`${supabaseUrl}/rest/v1/rpc/get_public_deals`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
}

async function fetchTable(supabaseUrl, supabaseKey, query) {
  if (!supabaseUrl || !supabaseKey) return [];
  return fetchJson(`${supabaseUrl}/rest/v1/${query}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
}

function isFinishedEvent(event, now = new Date()) {
  const publishAt = event?.publish_at;
  if (publishAt) {
    const publishDate = new Date(publishAt);
    if (!Number.isNaN(publishDate.getTime()) && publishDate.getTime() > now.getTime()) {
      return false;
    }
  }
  if (!event?.start_time) return false;
  const startTime = new Date(event.start_time);
  if (Number.isNaN(startTime.getTime()) || startTime > now) return false;
  if (event.end_time) {
    const endTime = new Date(event.end_time);
    if (!Number.isNaN(endTime.getTime())) return endTime.getTime() <= now.getTime();
  }
  return now.getTime() - startTime.getTime() >= 24 * 60 * 60 * 1000;
}

function faqSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

function sectionsHtml(sections) {
  return sections
    .map(
      ([heading, paragraph]) =>
        `<section><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(paragraph)}</p></section>`,
    )
    .join("\n");
}

function faqsHtml(items) {
  return items
    .map(
      (item) =>
        `<section><h2>${escapeHtml(item.question)}</h2><p>${escapeHtml(item.answer)}</p></section>`,
    )
    .join("\n");
}

function renderPage(res, { path, title, description, h1, intro, mainHtml, items, faqs }) {
  const canonicalUrl = `${SITE_URL}${path}`;
  const crumbs = [
    { name: "Home", url: `${SITE_URL}/` },
    { name: h1, url: canonicalUrl },
  ];
  const schemas = [
    breadcrumbList(crumbs),
  ];
  if (items) {
    schemas.unshift({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description,
      url: canonicalUrl,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: items.length,
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          url: item.url,
        })),
      },
    });
  }
  if (faqs) schemas.push(faqSchema(faqs));

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const schemaTags = schemas
    .map((schema) => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`)
    .join("\n    ");

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Uni Deals" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${DEFAULT_IMAGE}" />
    <meta property="og:locale" content="en_LK" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${DEFAULT_IMAGE}" />
    ${schemaTags}
  </head>
  <body>
    <main>
      <header>
        <p><a href="${SITE_URL}/">Uni Deals</a></p>
        <h1>${escapeHtml(h1)}</h1>
        <p>${escapeHtml(intro || description)}</p>
      </header>
      ${mainHtml}
      <nav aria-label="Site directory">
        <h2>Explore Uni Deals</h2>
        <ul>
          <li><a href="${SITE_URL}/deals">Deals</a></li>
          <li><a href="${SITE_URL}/brands">Brands</a></li>
          <li><a href="${SITE_URL}/categories">Categories</a></li>
          <li><a href="${SITE_URL}/events">Events</a></li>
          <li><a href="${SITE_URL}/blog">Blog</a></li>
        </ul>
      </nav>
    </main>
  </body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  res.status(200).send(html);
}

function listHtml(entries, emptyText) {
  if (!entries.length) return `<p>${escapeHtml(emptyText)}</p>`;
  return `<ul>${entries
    .map(
      (entry) =>
        `<li><a href="${entry.url}">${escapeHtml(entry.name)}</a>${
          entry.detail ? `<p>${escapeHtml(entry.detail)}</p>` : ""
        }</li>`,
    )
    .join("")}</ul>`;
}

export default async function handler(req, res) {
  const type = String(req.query.type || "");
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (type === "deals") {
    const deals = await fetchPublicDeals(supabaseUrl, supabaseKey);
    const items = deals.map((deal) => ({
      name: `${deal.brand}: ${deal.title || deal.discount}`,
      url: `${SITE_URL}/deals/${deal.id}`,
      detail: [deal.discount, deal.category].filter(Boolean).join(" · "),
    }));
    return renderPage(res, {
      path: "/deals",
      title: "All Student Deals & Discounts in Sri Lanka | Uni Deals",
      description:
        "Browse every exclusive student discount on Uni Deals — online promo codes and in-store deals across tech, food, fashion, and more in Sri Lanka.",
      h1: "All Student Deals",
      items,
      mainHtml: `<section><h2>Live student deals (${items.length})</h2>${listHtml(items, "New student discounts are added regularly.")}</section>`,
    });
  }

  if (type === "brands") {
    const deals = await fetchPublicDeals(supabaseUrl, supabaseKey);
    const byBrand = new Map();
    for (const deal of deals) {
      const slug = slugify(deal.brand);
      if (!slug || byBrand.has(slug)) continue;
      byBrand.set(slug, {
        name: deal.brand,
        url: `${SITE_URL}/brand/${slug}`,
        detail: deal.category || "",
      });
    }
    const items = [...byBrand.values()];
    return renderPage(res, {
      path: "/brands",
      title: "Top Brand Student Discounts in Sri Lanka | Uni Deals",
      description:
        "Browse every partner brand offering exclusive student discounts on Uni Deals — from tech and fashion to food and fitness, all across Sri Lanka.",
      h1: "Partner Directory",
      intro: "Meet the brands that bring exclusive perks to students in Sri Lanka.",
      items,
      mainHtml: `<section><h2>Partner brands (${items.length})</h2>${listHtml(items, "Partner brands appear here as deals go live.")}</section>`,
    });
  }

  if (type === "categories") {
    const items = OFFICIAL_CATEGORIES.map((name) => ({
      name,
      url: `${SITE_URL}/category/${slugify(name)}`,
      detail: CATEGORY_DESCRIPTIONS[name] || "",
    }));
    return renderPage(res, {
      path: "/categories",
      title: "All Student Discounts by Category | Uni Deals",
      description:
        "Browse every student discount in Sri Lanka organized by category — fashion, food, tech, travel, fitness, and more. Unlock offers with your verified university email.",
      h1: "Deals by Category",
      intro:
        "Find student deals sorted by what matters to you — from fashion and food to tech and events.",
      items,
      mainHtml: `<section><h2>Categories</h2>${listHtml(items, "Categories are listed above.")}</section>`,
    });
  }

  if (type === "events") {
    const rows = await fetchTable(
      supabaseUrl,
      supabaseKey,
      "events?select=id,title,start_time,end_time,publish_at,location_name,university_name,club_name&status=eq.approved&order=start_time.asc",
    );
    const items = rows
      .filter((event) => event?.id && event.title && !isFinishedEvent(event))
      .map((event) => ({
        name: event.title,
        url: `${SITE_URL}/events/${event.id}`,
        detail: [event.university_name || event.club_name, event.location_name]
          .filter(Boolean)
          .join(" · "),
      }));
    return renderPage(res, {
      path: "/events",
      title: "Student Events in Sri Lanka | Uni Deals",
      description:
        "Discover university events, tech fests, networking sessions, and society gatherings across Sri Lanka. Submit your own campus event for free on Uni Deals.",
      h1: "Events",
      intro:
        "Discover exclusive networking sessions, tech fests, and social gatherings on campus.",
      items,
      mainHtml: `<section><h2>Upcoming student events (${items.length})</h2>${listHtml(items, "Approved campus events will be listed here.")}</section>`,
    });
  }

  if (type === "blog") {
    const posts = await fetchTable(
      supabaseUrl,
      supabaseKey,
      "posts?select=slug,title,excerpt&is_published=eq.true&order=created_at.desc",
    );
    const items = posts
      .filter((post) => post?.slug && post.title)
      .map((post) => ({
        name: post.title,
        url: `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`,
        detail: post.excerpt || "",
      }));
    return renderPage(res, {
      path: "/blog",
      title: "Student Guides & Tips | Uni Deals Blog",
      description:
        "Tips, guides, and student life hacks to help Sri Lankan university students make the most of discounts, campus life, and their student budget.",
      h1: "Uni Deals Blog",
      intro:
        "Tips, guides, and student life hacks to help you make the most of your university experience.",
      items,
      mainHtml: `<section><h2>Articles (${items.length})</h2>${listHtml(items, "New student guides are published here.")}</section>`,
    });
  }

  if (type === "contact") {
    return renderPage(res, {
      path: "/contact",
      title: "Contact Us | Uni Deals",
      description:
        "Get in touch with Uni Deals for support, brand partnerships, or event collaboration. We respond to all inquiries within 24-48 hours.",
      h1: "Get in Touch / Partner With Us",
      intro:
        "Whether you have a question, want to host an event, or apply as a brand partner, we're here to help.",
      faqs: CONTACT_FAQS,
      mainHtml: `<section><h2>Response Time</h2><p>Our support and partnership teams aim to respond to all inquiries within 24–48 hours during regular business days. Email unideals.lk@gmail.com or use the contact form on this page.</p></section>${faqsHtml(CONTACT_FAQS)}`,
    });
  }

  if (type === "support") {
    return renderPage(res, {
      path: "/support",
      title: "Help & Support | Uni Deals",
      description:
        "Get help with student verification, redeeming deals, and your Uni Deals account. Contact our support team for assistance.",
      h1: "Help & Support",
      intro: "We're here to help you get the most out of Uni Deals.",
      faqs: SUPPORT_FAQS,
      mainHtml: `<section><h2>Email Us</h2><p>Have a question or need assistance? Email <a href="mailto:unideals.lk@gmail.com">unideals.lk@gmail.com</a>. The support team replies within 24 hours.</p></section><section><h2>Verification Help</h2><p>Having trouble verifying your student status? Make sure your university email is valid or use the manual verification method in your profile. Status expires after 12 months, so re-verify each year to keep access.</p></section><h2>Frequently asked</h2>${faqsHtml(SUPPORT_FAQS)}`,
    });
  }

  if (type === "privacy") {
    return renderPage(res, {
      path: "/privacy",
      title: "Privacy Policy | Uni Deals",
      description:
        "Learn how Uni Deals collects, uses, and protects your personal data on Sri Lanka's student discount platform.",
      h1: "Privacy Policy",
      intro: "Last updated: September 1, 2026. Uni Deals Trust Center.",
      mainHtml: sectionsHtml(PRIVACY_SECTIONS),
    });
  }

  if (type === "terms") {
    return renderPage(res, {
      path: "/terms",
      title: "Terms of Service | Uni Deals",
      description:
        "Read the Uni Deals Terms of Service — the rules governing your use of Sri Lanka's student discount platform.",
      h1: "Terms of Service",
      intro: "Last updated: September 1, 2026. Uni Deals Trust Center.",
      mainHtml: sectionsHtml(TERMS_SECTIONS),
    });
  }

  res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Page Not Found | Uni Deals</title>
    <meta name="robots" content="noindex, nofollow" />
  </head>
  <body>
    <h1>Page Not Found</h1>
    <p><a href="${SITE_URL}/">Uni Deals</a></p>
  </body>
</html>`);
}
