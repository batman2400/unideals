/**
 * Server-rendered Open Graph & Schema.org proxy for /category/:slug and /brand/:slug
 *
 * Serves fully prerendered HTML to search engines (Googlebot, Bingbot, ...)
 * and social preview bots (WhatsApp, Telegram, Facebook, Twitter, Slack, ...)
 * and AI answer engines (ChatGPT, Perplexity, Claude).
 *
 * Emits CollectionPage + ItemList JSON-LD schema, canonical, Open Graph,
 * 404 for unknown slugs, and a rich indexable HTML body with deal listings.
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

const OLD_TO_NEW_CATEGORY = {
  Tech: "Tech & Mobile",
  Coffee: "Food & Drink",
  Clothing: "Fashion",
  Fitness: "Health & Fitness",
  Home: "Household",
  Creative: "Learning",
  "Fashion & Apparel": "Fashion",
  "Health & Beauty": "Beauty & Care",
  "Food and Drink": "Food & Drink",
  "Food & Beverage": "Food & Drink",
  Beauty: "Beauty & Care",
  Health: "Health & Fitness",
  Travel: "Travel & Auto",
  Events: "Events & Tickets",
};

function normalizeCategory(category) {
  if (!category || typeof category !== "string") return "";
  const trimmed = category.trim();
  return OLD_TO_NEW_CATEGORY[trimmed] || trimmed;
}

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
  const { type, slug } = req.query;

  if (!slug || typeof slug !== "string") {
    res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(notFoundHtml("Page Not Found", "Invalid request parameters."));
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const deals = await fetchPublicDeals(supabaseUrl, supabaseKey);

  if (type === "category") {
    // Check official category taxonomy first
    let categoryName = OFFICIAL_CATEGORIES.find((cat) => slugify(cat) === slug);

    // Fall back to live deals if not in official list
    if (!categoryName) {
      const liveMatch = deals.find(
        (deal) => slugify(normalizeCategory(deal.category)) === slug,
      );
      if (liveMatch) {
        categoryName = normalizeCategory(liveMatch.category);
      }
    }

    if (!categoryName) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(
        notFoundHtml(
          "Category Not Found",
          "We could not find that student deals category.",
          `${SITE_URL}/categories`,
          "Browse all deal categories",
        ),
      );
    }

    const matchingDeals = deals.filter(
      (d) => normalizeCategory(d.category) === categoryName,
    );
    const canonicalUrl = `${SITE_URL}/category/${slug}`;
    const rawTitle = `${categoryName} Student Discounts & Offers in Sri Lanka | Uni Deals`;
    const rawDescription =
      CATEGORY_DESCRIPTIONS[categoryName] ||
      `Find the best ${categoryName} student discounts and offers in Sri Lanka on Uni Deals. Unlock savings with your verified university email.`;

    const title = escapeHtml(rawTitle);
    const description = escapeHtml(rawDescription);

    const schema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": rawTitle,
      "description": rawDescription,
      "url": canonicalUrl,
      "mainEntity": {
        "@type": "ItemList",
        "numberOfItems": matchingDeals.length,
        "itemListElement": matchingDeals.map((deal, idx) => ({
          "@type": "ListItem",
          "position": idx + 1,
          "name": `${deal.brand} - ${deal.title || deal.discount + " OFF"}`,
          "url": `${SITE_URL}/deals/${deal.id}`,
        })),
      },
    };

    const dealsHtml =
      matchingDeals.length > 0
        ? matchingDeals
            .map(
              (deal) => `
          <li>
            <article>
              <h3><a href="${SITE_URL}/deals/${deal.id}">${escapeHtml(deal.brand)}: ${escapeHtml(deal.discount)}</a></h3>
              <p>${escapeHtml(deal.description || deal.title || "")}</p>
            </article>
          </li>`,
            )
            .join("\n")
        : "<p>New student discounts are being added regularly. Check back soon!</p>";

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Uni Deals" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${DEFAULT_IMAGE}" />
    <meta property="og:locale" content="en_LK" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${DEFAULT_IMAGE}" />
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
  </head>
  <body>
    <main>
      <header>
        <p><strong>Category Hub:</strong> Sri Lanka Student Discounts</p>
        <h1>${title}</h1>
      </header>
      <section>
        <p>${description}</p>
      </section>
      <section>
        <h2>Available ${escapeHtml(categoryName)} Student Deals (${matchingDeals.length})</h2>
        <ul>
          ${dealsHtml}
        </ul>
      </section>
      <nav aria-label="Related links">
        <ul>
          <li><a href="${SITE_URL}/categories">All Deal Categories</a></li>
          <li><a href="${SITE_URL}/deals">All Student Deals</a></li>
          <li><a href="${SITE_URL}">Uni Deals Homepage</a></li>
        </ul>
      </nav>
    </main>
  </body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).send(html);
  }

  if (type === "brand") {
    const matchingDeals = deals.filter((d) => slugify(d.brand) === slug);

    if (matchingDeals.length === 0) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(
        notFoundHtml(
          "Brand Not Found",
          "We could not find any active student offers for that brand.",
          `${SITE_URL}/brands`,
          "Browse all partner brands",
        ),
      );
    }

    const brandName = matchingDeals[0].brand;
    const canonicalUrl = `${SITE_URL}/brand/${slug}`;
    const rawTitle = `${brandName} Student Discounts & Offers | Uni Deals`;
    const rawDescription = `Save on ${brandName} with exclusive student discounts in Sri Lanka. Unlock offers with your verified university email on Uni Deals.`;
    const brandImage = matchingDeals[0].image_url || DEFAULT_IMAGE;

    const title = escapeHtml(rawTitle);
    const description = escapeHtml(rawDescription);

    const schema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": rawTitle,
      "description": rawDescription,
      "url": canonicalUrl,
      "about": {
        "@type": "Brand",
        "name": brandName,
      },
      "mainEntity": {
        "@type": "ItemList",
        "numberOfItems": matchingDeals.length,
        "itemListElement": matchingDeals.map((deal, idx) => ({
          "@type": "ListItem",
          "position": idx + 1,
          "name": `${deal.brand} - ${deal.title || deal.discount + " OFF"}`,
          "url": `${SITE_URL}/deals/${deal.id}`,
        })),
      },
    };

    const dealsHtml = matchingDeals
      .map(
        (deal) => `
        <li>
          <article>
            <h3><a href="${SITE_URL}/deals/${deal.id}">${escapeHtml(deal.title || deal.discount + " OFF")}</a></h3>
            <p><strong>Discount:</strong> ${escapeHtml(deal.discount)} (${escapeHtml(deal.type || "Online & In-Store")})</p>
            <p>${escapeHtml(deal.description || "")}</p>
          </article>
        </li>`,
      )
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Uni Deals" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${brandImage}" />
    <meta property="og:locale" content="en_LK" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${brandImage}" />
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
  </head>
  <body>
    <main>
      <header>
        <p><strong>Partner Brand:</strong> Sri Lanka Student Deals</p>
        <h1>${title}</h1>
      </header>
      <section>
        <p>${description}</p>
      </section>
      <section>
        <h2>Available ${escapeHtml(brandName)} Student Perks (${matchingDeals.length})</h2>
        <ul>
          ${dealsHtml}
        </ul>
      </section>
      <nav aria-label="Related links">
        <ul>
          <li><a href="${SITE_URL}/brands">All Partner Brands</a></li>
          <li><a href="${SITE_URL}/deals">All Student Deals</a></li>
          <li><a href="${SITE_URL}">Uni Deals Homepage</a></li>
        </ul>
      </nav>
    </main>
  </body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).send(html);
  }

  res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(notFoundHtml("Hub Not Found", "Invalid hub type."));
}

function notFoundHtml(
  title = "Not Found",
  message = "This page may have been moved or removed.",
  linkUrl = `${SITE_URL}/deals`,
  linkText = "Browse student deals",
) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} | Uni Deals</title>
    <meta name="robots" content="noindex, nofollow" />
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <p><a href="${linkUrl}">${escapeHtml(linkText)}</a></p>
  </body>
</html>`;
}
