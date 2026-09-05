/**
 * Server-rendered Open Graph & Schema.org proxy for /deals/:id
 *
 * Serves fully prerendered HTML to search engines (Googlebot, Bingbot,
 * Applebot, ...) and social preview bots (WhatsApp, Telegram, Facebook,
 * Twitter/X, Discord, Slack, iMessage) and AI answer engines (ChatGPT,
 * Perplexity, Claude).
 *
 * Emits Product + nested Offer JSON-LD schema, canonical, Open Graph,
 * and a rich indexable HTML body with internal links to category & brand hubs.
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

export default async function handler(req, res) {
  const { id } = req.query;
  const dealId = Number(id);

  if (!id || !Number.isInteger(dealId) || dealId <= 0) {
    res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(notFoundHtml());
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  try {
    const rpcRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_public_deal_by_id`,
      {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target_deal_id: dealId }),
      },
    );

    if (!rpcRes.ok) throw new Error(`Upstream responded ${rpcRes.status}`);

    const data = await rpcRes.json();
    const deal = Array.isArray(data) ? data[0] : data;

    if (!deal) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(notFoundHtml());
    }

    const canonicalUrl = `${SITE_URL}/deals/${deal.id}`;
    const brandSlug = slugify(deal.brand);
    const categorySlug = slugify(deal.category);
    const brandUrl = brandSlug ? `${SITE_URL}/brand/${brandSlug}` : `${SITE_URL}/brands`;
    const categoryUrl = categorySlug ? `${SITE_URL}/category/${categorySlug}` : `${SITE_URL}/categories`;

    const rawTitle = `${deal.brand} Student Discount: ${deal.discount} | Uni Deals`;
    const rawDescription =
      deal.description ||
      `Save ${deal.discount} on ${deal.brand} with your verified Sri Lankan university email — redeem on Uni Deals.`;
    const rawImage = deal.image_url || DEFAULT_IMAGE;

    const title = escapeHtml(rawTitle);
    const description = escapeHtml(rawDescription);
    const image = escapeHtml(rawImage);

    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": `${deal.brand} - ${deal.title || deal.discount + " OFF"}`,
      "description": rawDescription,
      "image": [rawImage],
      "brand": {
        "@type": "Brand",
        "name": deal.brand,
      },
      "category": deal.category || "Student Deals",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "LKR",
        "availability": "https://schema.org/InStock",
        "url": canonicalUrl,
        "areaServed": {
          "@type": "Country",
          "name": "Sri Lanka",
        },
        "eligibleRegion": {
          "@type": "Country",
          "name": "Sri Lanka",
        },
        "eligibleCustomerType": "http://purl.org/goodrelations/v1#Enduser",
      },
    };

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="Uni Deals" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="en_LK" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
  </head>
  <body>
    <article>
      <header>
        <p><strong>Brand:</strong> <a href="${brandUrl}">${escapeHtml(deal.brand)}</a></p>
        <p><strong>Category:</strong> <a href="${categoryUrl}">${escapeHtml(deal.category || "General")}</a></p>
        <h1>${title}</h1>
      </header>
      <section>
        <p><strong>Discount Offer:</strong> ${escapeHtml(deal.discount)} (${escapeHtml(deal.type || "Online & In-Store")})</p>
        <p>${description}</p>
      </section>
      <section>
        <p>Verified university students in Sri Lanka can unlock this exclusive student perk using their university email on <a href="${SITE_URL}">Uni Deals</a>.</p>
      </section>
      <nav aria-label="Related links">
        <ul>
          <li><a href="${SITE_URL}/deals">All Student Deals</a></li>
          <li><a href="${brandUrl}">More ${escapeHtml(deal.brand)} Deals</a></li>
          <li><a href="${categoryUrl}">More ${escapeHtml(deal.category || "Student")} Discounts</a></li>
          <li><a href="${SITE_URL}">Uni Deals Homepage</a></li>
        </ul>
      </nav>
    </article>
  </body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    res.status(200).send(html);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
}

function notFoundHtml() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Deal Not Found | Uni Deals</title>
    <meta name="robots" content="noindex, nofollow" />
    <meta property="og:title" content="Deal Not Found | Uni Deals" />
    <meta property="og:description" content="This deal may have expired or been removed." />
  </head>
  <body>
    <h1>Deal Not Found</h1>
    <p>This student deal may have expired or is no longer available.</p>
    <p><a href="${SITE_URL}/deals">Browse all active student deals</a></p>
  </body>
</html>`;
}
