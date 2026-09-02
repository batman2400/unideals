/**
 * Shared SEO helpers.
 *
 * Centralizes the production origin and the slug algorithm used to build
 * clean, crawlable URLs (/category/:slug, /brand/:slug) from free-text
 * category and brand names stored in Supabase.
 */
export const SITE_URL = "https://www.unideals.co";

/** Default 1200×630 social card (WhatsApp / iMessage / Twitter). */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
export const DEFAULT_OG_IMAGE_WIDTH = "1200";
export const DEFAULT_OG_IMAGE_HEIGHT = "630";

/**
 * Turns a free-text name into a URL-safe, lowercase, hyphenated slug.
 * e.g. "Tech & Mobile" -> "tech-mobile", "Domino's Pizza" -> "domino-s-pizza"
 */
export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Crawlable hub for a category name (`/category/food-drink`). */
export function categoryHubPath(name) {
  const slug = slugify(name);
  return slug ? `/category/${slug}` : "/categories";
}

/** Crawlable hub for a brand name (`/brand/spa-ceylon`). */
export function brandHubPath(name) {
  const slug = slugify(name);
  return slug ? `/brand/${slug}` : "/brands";
}

/**
 * Home “explore brands” search: empty → directory, unique match → hub,
 * otherwise a filtered directory URL.
 */
export function resolveBrandExplorePath(query, brandNames) {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) return "/brands";

  const names = Array.isArray(brandNames)
    ? [...new Set(brandNames.filter(Boolean))]
    : [];
  const needle = trimmed.toLowerCase();
  const exact = names.find((name) => name.toLowerCase() === needle);
  if (exact) return brandHubPath(exact);

  const startsWith = names.filter((name) =>
    name.toLowerCase().startsWith(needle),
  );
  if (startsWith.length === 1) return brandHubPath(startsWith[0]);

  const contains = names.filter((name) => name.toLowerCase().includes(needle));
  if (contains.length === 1) return brandHubPath(contains[0]);

  return `/brands?q=${encodeURIComponent(trimmed)}`;
}
