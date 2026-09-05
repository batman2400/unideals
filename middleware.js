/**
 * Vercel Routing Middleware
 *
 * 1) Canonical host: any request on the default Vercel hostname
 *    (*.vercel.app production alias) permanently redirects to
 *    https://www.unideals.co so Bing/Google stop ranking the deploy URL
 *    for branded searches like "unideals co".
 *
 * 2) /deals/:id validity guard: invalid/missing deal IDs get HTTP 404
 *    while rewriting to the SPA shell (Uni Deals chrome, not Vercel's
 *    default 404 page).
 *
 * 3) Unknown HTML paths also get HTTP 404 via the same SPA rewrite.
 */
import { next, rewrite } from "@vercel/functions";

const CANONICAL_ORIGIN = "https://www.unideals.co";

/** Full bot user-agent pattern matching search engines, social scrapers, and AI answer engines. */
export const BOT_UA_REGEX =
  /(googlebot|bingbot|applebot|duckduckbot|yandex|baiduspider|gptbot|chatgpt-user|claudebot|anthropic|perplexitybot|bytespider|facebookexternalhit|twitterbot|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|skypeuripreview|pinterest|vkShare|W3C_Validator|atproto)/i;

/** Production Vercel alias that Bing already indexed. */
const VERCEL_PRODUCTION_HOSTS = new Set([
  "unideals-nine.vercel.app",
]);

const EXACT_PATHS = new Set([
  "/",
  "/deals",
  "/categories",
  "/brands",
  "/events",
  "/events/new",
  "/blog",
  "/contact",
  "/support",
  "/terms",
  "/privacy",
  "/delete-account",
  "/profile",
  "/saved",
  "/reset-password",
  "/auth/callback",
  "/perks",
  "/login",
  "/signup",
]);

const ONE_SEGMENT_PREFIXES = new Set([
  "deals",
  "perks",
  "category",
  "brand",
  "events",
  "blog",
]);

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

/** SPA index with HTTP 404 — Uni Deals chrome, not Vercel's default page. */
function spaNotFound(request) {
  return rewrite(new URL("/", request.url), { status: 404 });
}

function isKnownAppPath(pathname) {
  const path = normalizePath(pathname);
  if (EXACT_PATHS.has(path)) return true;
  if (path === "/admin" || path.startsWith("/admin/")) return true;
  if (path === "/partner" || path.startsWith("/partner/")) return true;

  const parts = path.split("/").filter(Boolean);
  if (parts.length === 2 && ONE_SEGMENT_PREFIXES.has(parts[0]) && parts[1]) {
    return true;
  }

  return false;
}

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

  const path = normalizePath(url.pathname);

  // ── Bot prerendering for Homepage (/) ────────────────────────────────
  // Vercel serves static dist/index.html on / before vercel.json rewrites.
  // Intercepting bots here at Edge middleware ensures search engines,
  // social crawlers, and AI answer engines receive rich pre-rendered HTML.
  const userAgent = request.headers.get("user-agent") || "";
  if (path === "/" && BOT_UA_REGEX.test(userAgent)) {
    return rewrite(new URL(`/api/home-og-proxy${url.search}`, request.url));
  }

  // ── /deals/:id existence check ───────────────────────────────────────
  if (path.startsWith("/deals/") && path !== "/deals") {
    const id = path.split("/")[2] ?? "";
    const numericId = Number(id);
    const isValidIdShape =
      id.length > 0 && Number.isInteger(numericId) && numericId > 0;

    if (!isValidIdShape) {
      return spaNotFound(request);
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

      return dealExists ? next() : spaNotFound(request);
    } catch {
      return next();
    }
  }

  if (!isKnownAppPath(path)) {
    return spaNotFound(request);
  }

  return next();
}
