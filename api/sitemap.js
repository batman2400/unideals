/**
 * Dynamic sitemap.xml
 *
 * Served at /sitemap.xml via the vercel.json rewrite. Combines the static
 * marketing routes with every live, indexable entity in Supabase — approved
 * deals, approved events, blog posts, and the derived category/brand
 * landing pages — so crawlers can discover content that previously only
 * existed behind client-side JS and query-string filters.
 */
const SITE_URL = "https://www.unideals.co";

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchTable(supabaseUrl, supabaseKey, query) {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${query}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Deals are not readable via direct table SELECT for anon (RLS). */
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

function toIso(value, fallback) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
}

function urlEntry(loc, { lastmod, changefreq, priority } = {}) {
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const now = new Date().toISOString();

  try {
    const [posts, deals, events] = await Promise.all([
      fetchTable(supabaseUrl, supabaseKey, "posts?select=slug,updated_at,created_at&is_published=eq.true"),
      fetchPublicDeals(supabaseUrl, supabaseKey),
      fetchTable(
        supabaseUrl,
        supabaseKey,
        "events?select=id,created_at,start_time&status=eq.approved",
      ),
    ]);

    const staticEntries = [
      urlEntry(`${SITE_URL}/`, { changefreq: "daily", priority: "1.0" }),
      urlEntry(`${SITE_URL}/deals`, { changefreq: "hourly", priority: "0.9" }),
      urlEntry(`${SITE_URL}/categories`, { changefreq: "daily", priority: "0.8" }),
      urlEntry(`${SITE_URL}/brands`, { changefreq: "daily", priority: "0.8" }),
      urlEntry(`${SITE_URL}/events`, { changefreq: "daily", priority: "0.8" }),
      urlEntry(`${SITE_URL}/blog`, { changefreq: "daily", priority: "0.7" }),
      urlEntry(`${SITE_URL}/contact`, { changefreq: "monthly", priority: "0.3" }),
      urlEntry(`${SITE_URL}/support`, { changefreq: "monthly", priority: "0.3" }),
      urlEntry(`${SITE_URL}/terms`, { changefreq: "yearly", priority: "0.2" }),
      urlEntry(`${SITE_URL}/privacy`, { changefreq: "yearly", priority: "0.2" }),
    ];

    const dealEntries = deals.map((deal) =>
      urlEntry(`${SITE_URL}/deals/${deal.id}`, {
        lastmod: toIso(deal.created_at, now),
        changefreq: "weekly",
        priority: "0.7",
      }),
    );

    const eventEntries = events.map((event) =>
      urlEntry(`${SITE_URL}/events/${event.id}`, {
        lastmod: toIso(event.created_at || event.start_time, now),
        changefreq: "weekly",
        priority: "0.6",
      }),
    );

    const postEntries = posts.map((post) =>
      urlEntry(`${SITE_URL}/blog/${post.slug}`, {
        lastmod: toIso(post.updated_at || post.created_at, now),
        changefreq: "weekly",
        priority: "0.6",
      }),
    );

    // Derive the set of category/brand landing pages actually backed by
    // live approved deals, so the sitemap never points to empty pages.
    const categorySlugs = new Map();
    const brandSlugs = new Map();
    deals.forEach((deal) => {
      if (deal.category) {
        const slug = slugify(deal.category);
        if (slug && !categorySlugs.has(slug)) categorySlugs.set(slug, deal.created_at);
      }
      if (deal.brand) {
        const slug = slugify(deal.brand);
        if (slug && !brandSlugs.has(slug)) brandSlugs.set(slug, deal.created_at);
      }
    });

    const categoryEntries = Array.from(categorySlugs.entries()).map(([slug, lastmod]) =>
      urlEntry(`${SITE_URL}/category/${slug}`, {
        lastmod: toIso(lastmod, now),
        changefreq: "weekly",
        priority: "0.6",
      }),
    );

    const brandEntries = Array.from(brandSlugs.entries()).map(([slug, lastmod]) =>
      urlEntry(`${SITE_URL}/brand/${slug}`, {
        lastmod: toIso(lastmod, now),
        changefreq: "weekly",
        priority: "0.6",
      }),
    );

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...dealEntries, ...categoryEntries, ...brandEntries, ...eventEntries, ...postEntries].join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(sitemap);
  } catch (error) {
    console.error("[sitemap] generation failed:", error);
    res.status(500).send("Error generating sitemap");
  }
}
