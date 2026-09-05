/**
 * Server-rendered Homepage proxy for /
 *
 * Serves rich, pre-rendered HTML to search engine crawlers (Googlebot,
 * Bingbot, Applebot, DuckDuckGo, ...) and AI answer engines (ChatGPT,
 * Perplexity, Claude) when visiting the root URL.
 *
 * Emits WebSite SearchAction, Organization (#organization), and FAQPage JSON-LD,
 * alongside a complete semantic HTML body with category hubs, live deals,
 * visible FAQs, supported campuses, and footer sitelinks.
 * NEVER emits secret redemption codes in bot HTML.
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

const SITE_URL = "https://www.unideals.co";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

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

const HOME_FAQS = [
  {
    question: "How do I claim student offers in Sri Lanka?",
    answer:
      "Sign up on Uni Deals, then verify from your Profile. Entering the verification code sent to your university email (.ac.lk or campus domain) verifies you immediately. School students and anyone without an institute email upload a student ID for manual admin review. Once verified, online deals reveal a promo code and in-store deals generate a timed redemption ticket on your phone.",
  },
  {
    question: "Which brands give student discounts in Sri Lanka?",
    answer:
      "Browse Deals, Brands, and Categories on Uni Deals for live offers from partners including Spa Ceylon, Tea Avenue, and leading tech, fashion, dining, and wellness brands across Sri Lanka. New discounts are regularly added for verified students.",
  },
  {
    question: "Is my university email eligible for student deals?",
    answer:
      "Institute emails (.ac.lk, .edu, and listed campus domains like SLIIT, NSBM, IIT, KDU, Moratuwa, Colombo, and others) are verified instantly with a one-time code. Gmail and school students can verify by uploading a student ID for quick admin review.",
  },
  {
    question: "How long is my student verification valid?",
    answer:
      "Student verification on Uni Deals is valid for 12 months from approval. You can easily renew your verification every year as long as you are an active student.",
  },
];

async function fetchPublicDeals(supabaseUrl, supabaseKey) {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_deals`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  const deals = await fetchPublicDeals(supabaseUrl, supabaseKey);

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    "name": "Uni Deals",
    "alternateName": "UniDeals",
    "url": SITE_URL,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${SITE_URL}/deals?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    "name": "Uni Deals",
    "alternateName": "UniDeals",
    "url": SITE_URL,
    "logo": {
      "@type": "ImageObject",
      "url": `${SITE_URL}/logo-512.png`,
      "width": 512,
      "height": 512,
    },
    "image": `${SITE_URL}/logo-512.png`,
    "description":
      "Dedicated discount and perks platform for university and tertiary students in Sri Lanka.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Colombo",
      "addressCountry": "LK",
    },
    "areaServed": {
      "@type": "Country",
      "name": "Sri Lanka",
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "email": "unideals.lk@gmail.com",
      "contactType": "customer support",
      "areaServed": "LK",
      "availableLanguage": ["English", "Sinhala", "Tamil"],
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": HOME_FAQS.map((item) => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer,
      },
    })),
  };

  const title =
    "Uni Deals | The Best Student Discounts & Offers in Sri Lanka";
  const description =
    "Unlock exclusive student discounts and the best student offers in Sri Lanka. Save on daily dining, tech accessories, and clothing using your verified university email.";

  const categoryLinksHtml = OFFICIAL_CATEGORIES.map(
    (cat) =>
      `<li><a href="${SITE_URL}/category/${slugify(cat)}">${escapeHtml(cat)} Deals</a></li>`,
  ).join("\n");

  const dealsHtml =
    deals.length > 0
      ? deals
          .map(
            (deal) => `
        <li>
          <article>
            <h3><a href="${SITE_URL}/deals/${deal.id}">${escapeHtml(deal.brand)}: ${escapeHtml(deal.discount)}</a></h3>
            <p>${escapeHtml(deal.title || deal.description || "")}</p>
            <p><strong>Category:</strong> <a href="${SITE_URL}/category/${slugify(deal.category || "general")}">${escapeHtml(deal.category || "Deals")}</a></p>
          </article>
        </li>`,
          )
          .join("\n")
      : "<p>Live student deals are updated regularly. Browse our full deals directory.</p>";

  const faqsHtml = HOME_FAQS.map(
    (faq) => `
      <div>
        <h3>${escapeHtml(faq.question)}</h3>
        <p>${escapeHtml(faq.answer)}</p>
      </div>`,
  ).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <link rel="canonical" href="${SITE_URL}/" />
    <link rel="alternate" hreflang="en-LK" href="${SITE_URL}/" />
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />
    <meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Uni Deals" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${SITE_URL}/" />
    <meta property="og:image" content="${DEFAULT_IMAGE}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="en_LK" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${DEFAULT_IMAGE}" />
    <script type="application/ld+json">${JSON.stringify(websiteSchema)}</script>
    <script type="application/ld+json">${JSON.stringify(orgSchema)}</script>
    <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
  </head>
  <body>
    <main>
      <header>
        <h1>Exclusive Discounts &amp; Perks for University Students in Sri Lanka</h1>
        <p>${description}</p>
      </header>

      <section aria-label="Deal categories">
        <h2>Browse Student Deals by Category</h2>
        <ul>
          ${categoryLinksHtml}
        </ul>
      </section>

      <section aria-label="Featured student deals">
        <h2>Featured Student Deals in Sri Lanka (${deals.length})</h2>
        <ul>
          ${dealsHtml}
        </ul>
      </section>

      <section aria-label="Frequently asked questions">
        <h2>Frequently Asked Questions</h2>
        ${faqsHtml}
      </section>

      <section aria-label="Supported Sri Lankan universities">
        <h2>Supported Campuses &amp; Institutes</h2>
        <p>Available for students at SLIIT, NSBM, University of Colombo, University of Moratuwa, University of Peradeniya, University of Kelaniya, KDU, IIT, CINEC, NIBM, APIIT, and more across Sri Lanka.</p>
      </section>

      <nav aria-label="Site directory">
        <h2>Quick Links</h2>
        <ul>
          <li><a href="${SITE_URL}/deals">All Student Deals</a></li>
          <li><a href="${SITE_URL}/categories">Deal Categories</a></li>
          <li><a href="${SITE_URL}/brands">Partner Brands Directory</a></li>
          <li><a href="${SITE_URL}/events">Campus &amp; University Events</a></li>
          <li><a href="${SITE_URL}/blog">Student Guides &amp; Blog</a></li>
          <li><a href="${SITE_URL}/contact">Partner With Us / Contact</a></li>
          <li><a href="${SITE_URL}/support">Student Support</a></li>
          <li><a href="${SITE_URL}/terms">Terms of Service</a></li>
          <li><a href="${SITE_URL}/privacy">Privacy Policy</a></li>
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
