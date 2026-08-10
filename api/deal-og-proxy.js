/**
 * Server-rendered Open Graph proxy for /deals/:id
 *
 * react-helmet-async only injects <title>/og:* tags into the DOM after
 * JavaScript executes. Social-preview crawlers (Facebook, Twitter/X,
 * WhatsApp, LinkedIn, Slack, ...) do not execute JavaScript, so they would
 * otherwise only ever see the static, generic tags from index.html for
 * every shared /deals/:id link.
 *
 * vercel.json rewrites requests from those specific user agents to this
 * function (mirroring the existing /blog/:slug -> api/og-proxy.js rule),
 * which fetches the deal via the same public RPC the client app uses and
 * returns a minimal, fully server-rendered HTML document with accurate
 * per-deal title/description/image tags. Human visitors and Googlebot
 * (which does render JS) are unaffected and keep hitting the normal SPA.
 */
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const SITE_URL = "https://www.unideals.co";
const DEFAULT_IMAGE = `${SITE_URL}/icon-512-v7.png`;

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
    const title = escapeHtml(
      `${deal.brand} Student Discount: ${deal.discount} | Uni Deals`,
    );
    const description = escapeHtml(
      deal.description ||
        `Save ${deal.discount} on ${deal.brand} with your verified Sri Lankan university email — redeem on Uni Deals.`,
    );
    const image = escapeHtml(deal.image_url || DEFAULT_IMAGE);

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
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
  </head>
  <body>
    <h1>${title}</h1>
    <p>${description}</p>
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
  </body>
</html>`;
}
