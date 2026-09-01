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
 * e.g. "Tech & Mobile" -> "tech-mobile", "Domino's Pizza" -> "dominos-pizza"
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
