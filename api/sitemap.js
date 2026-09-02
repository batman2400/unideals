/**
 * Dynamic sitemap.xml
 *
 * Served at /sitemap.xml via the vercel.json rewrite. Combines the static
 * marketing routes with every live, indexable entity in Supabase — approved
 * deals, approved events, blog posts, and the derived category/brand
 * landing pages — so crawlers can discover content that previously only
 * existed behind client-side JS and query-string filters.
 *
 * Never 500: if Supabase is slow or a column is missing, still emit the
 * static marketing URLs (and whatever fetches succeeded).
 */
const SITE_URL = "https://www.unideals.co";
const FETCH_TIMEOUT_MS = 8000;

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchTable(supabaseUrl, supabaseKey, query) {
  if (!supabaseUrl || !supabaseKey) return [];
  const timeout = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${query}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      signal: timeout.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  } finally {
    timeout.clear();
  }
}

/** Deals are not readable via direct table SELECT for anon (RLS). */
async function fetchPublicDeals(supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) return [];
  const timeout = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_deals`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: timeout.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  } finally {
    timeout.clear();
  }
}

function toIso(value, fallback) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
}

/** Match src/lib/comingSoon.js isFinishedEvent (keep sitemap self-contained). */
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

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc, { lastmod, changefreq, priority } = {}) {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : null,
    changefreq ? `    <changefreq>${escapeXml(changefreq)}</changefreq>` : null,
    priority ? `    <priority>${escapeXml(priority)}</priority>` : null,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

function staticEntries() {
  return [
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
}

function buildXml(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;
}

function sendXml(res, xml) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const now = new Date().toISOString();

  try {
    const [posts, deals, events] = await Promise.all([
      // posts has created_at, not updated_at — selecting a missing column 400s.
      fetchTable(
        supabaseUrl,
        supabaseKey,
        "posts?select=slug,created_at&is_published=eq.true",
      ),
      fetchPublicDeals(supabaseUrl, supabaseKey),
      fetchTable(
        supabaseUrl,
        supabaseKey,
        "events?select=id,created_at,start_time,end_time,publish_at&status=eq.approved",
      ),
    ]);

    const dealEntries = deals.map((deal) =>
      urlEntry(`${SITE_URL}/deals/${deal.id}`, {
        lastmod: toIso(deal.created_at, now),
        changefreq: "weekly",
        priority: "0.7",
      }),
    );

    const eventEntries = events
      .filter((event) => !isFinishedEvent(event))
      .map((event) =>
        urlEntry(`${SITE_URL}/events/${event.id}`, {
          lastmod: toIso(event.created_at || event.start_time, now),
          changefreq: "weekly",
          priority: "0.6",
        }),
      );

    const postEntries = posts.map((post) =>
      urlEntry(`${SITE_URL}/blog/${post.slug}`, {
        lastmod: toIso(post.created_at, now),
        changefreq: "weekly",
        priority: "0.6",
      }),
    );

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

    sendXml(
      res,
      buildXml([
        ...staticEntries(),
        ...dealEntries,
        ...categoryEntries,
        ...brandEntries,
        ...eventEntries,
        ...postEntries,
      ]),
    );
  } catch (error) {
    console.error("[sitemap] generation failed:", error);
    sendXml(res, buildXml(staticEntries()));
  }
}
