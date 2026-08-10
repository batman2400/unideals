/**
 * Vercel Routing Middleware — /perks/:id validity guard
 *
 * This is a Vite SPA (no server-side rendering), so every non-file route is
 * rewritten to index.html by vercel.json and would otherwise always respond
 * with HTTP 200 — even for a deal ID that doesn't exist. That is bad for SEO:
 * Googlebot has no signal to drop an expired/invalid /perks/:id URL from the
 * index, and it can look like a soft-404 or thin-content page.
 *
 * This middleware runs at the edge, before rewrites, and:
 *   1. Rejects non-numeric ids immediately (no DB round-trip needed).
 *   2. Confirms the id exists via the same `get_public_deal_by_id` RPC the
 *      client uses, over the Supabase REST API.
 *   3. Lets the request continue to the normal SPA rewrite (so React Router
 *      still renders the "Deal Not Found" UI), but forces the HTTP status of
 *      that response to 404 when the id is invalid/missing.
 *
 * On any transient error (missing env vars, Supabase timeout, etc.) it fails
 * OPEN — i.e. it does not 404 a page just because a health check hiccuped.
 */
import { next } from "@vercel/functions";

export const config = {
  matcher: ["/perks/:id"],
};

export default async function middleware(request) {
  const { pathname } = new URL(request.url);
  const id = pathname.split("/")[2] ?? "";

  const numericId = Number(id);
  const isValidIdShape =
    id.length > 0 && Number.isInteger(numericId) && numericId > 0;

  if (!isValidIdShape) {
    return next({ status: 404 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  // Fail open if Supabase isn't reachable/configured — better a false
  // "200 + not found UI" than incorrectly 404'ing every deal page.
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
