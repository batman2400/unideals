/**
 * Vercel Routing Middleware
 *
 * 1) Canonical host: any request on the default Vercel hostname
 *    (*.vercel.app production alias) permanently redirects to
 *    https://www.unideals.co so Bing/Google stop ranking the deploy URL
 *    for branded searches like "unideals co".
 *
 * 2) /perks/:id validity guard: invalid/missing deal IDs get a real
 *    HTTP 404 instead of a soft SPA 200.
 */
import { next } from "@vercel/functions";

const CANONICAL_ORIGIN = "https://www.unideals.co";

/** Production Vercel alias that Bing already indexed. */
const VERCEL_PRODUCTION_HOSTS = new Set([
  "unideals-nine.vercel.app",
]);

export const config = {
  matcher: [
    "/",
    "/((?!api/|_next/|.*\\..*).*)",
  ],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const host = (request.headers.get("host") || url.host || "")
    .split(":")[0]
    .toLowerCase();

  // ── Force preferred host off the public *.vercel.app production URL ──
  // Only the stable production alias — not PR/preview deployment URLs.
  if (VERCEL_PRODUCTION_HOSTS.has(host)) {
    const target = new URL(
      `${url.pathname}${url.search}`,
      CANONICAL_ORIGIN,
    );
    return Response.redirect(target, 308);
  }

  // ── /perks/:id existence check ───────────────────────────────────────
  if (!url.pathname.startsWith("/perks/")) {
    return next();
  }

  const id = url.pathname.split("/")[2] ?? "";
  const numericId = Number(id);
  const isValidIdShape =
    id.length > 0 && Number.isInteger(numericId) && numericId > 0;

  if (!isValidIdShape) {
    return next({ status: 404 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return next();
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_public_deal_by_id`,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target_deal_id: numericId }),
      },
    );

    if (!res.ok) return next();

    const data = await res.json();
    const dealExists = Array.isArray(data) ? data.length > 0 : Boolean(data);

    return dealExists ? next() : next({ status: 404 });
  } catch {
    return next();
  }
}
