/**
 * Shared SEO helpers.
 *
 * Centralizes the production origin and the slug algorithm used to build
 * clean, crawlable URLs (/category/:slug, /brand/:slug) from free-text
 * category and brand names stored in Supabase.
 */
export const SITE_URL = "https://www.unideals.co";

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
