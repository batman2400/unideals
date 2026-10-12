import { supabase } from "./supabaseClient";

export const PERK_CATEGORIES = [
  "AI",
  "Learning",
  "Design",
  "Cloud",
  "Software",
  "Domains",
  "Security",
  "Productivity",
  "Music",
  "Video",
];

export const PERK_COLUMNS =
  "id, provider_name, logo_url, category, summary, eligibility, claim_steps, official_url, availability, last_verified_on, is_active, sort_order";

export function mapPerk(row) {
  return {
    id: row.id,
    providerName: row.provider_name,
    logoUrl: row.logo_url,
    category: row.category,
    summary: row.summary,
    eligibility: row.eligibility,
    claimSteps: String(row.claim_steps ?? "")
      .split("\n")
      .map((step) => step.trim())
      .filter(Boolean),
    officialUrl: row.official_url,
    availability: row.availability,
    lastVerifiedOn: row.last_verified_on,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

/** Same-origin marks. A saved https logo_url replaces these. */
const PERK_LOGOS = {
  "GitHub Student Developer Pack": "/perk-logos/github.svg",
  "Google Gemini for students": "/perk-logos/googlegemini.svg",
  "JetBrains educational licenses": "/perk-logos/jetbrains.svg",
  "Autodesk Education": "/perk-logos/autodesk.svg",
  "Notion Education Plan": "/perk-logos/notion.svg",
  "Spotify Premium Student": "/perk-logos/spotify.svg",
  "YouTube Premium Student": "/perk-logos/youtube.svg",
  "Canva Education": "/perk-logos/canva.svg",
  Namecheap: "/perk-logos/namecheap.svg",
  "Microsoft Azure": "/perk-logos/microsoftazure.svg",
  "Microsoft Azure (ages 13-17)": "/perk-logos/microsoftazure.svg",
  "Microsoft 365": "/perk-logos/microsoft.svg",
  "GitHub Pro": "/perk-logos/github.svg",
  "Notion for GitHub students": "/perk-logos/notion.svg",
  "Notion Template Collection": "/perk-logos/notion.svg",
  DataCamp: "/perk-logos/datacamp.svg",
  "GitHub Copilot": "/perk-logos/githubcopilot.svg",
  Heroku: "/perk-logos/heroku.svg",
  Educative: "/perk-logos/educative.svg",
  Termius: "/perk-logos/termius.svg",
  MongoDB: "/perk-logos/mongodb.svg",
  Datadog: "/perk-logos/datadog.svg",
  "GitHub Codespaces": "/perk-logos/github.svg",
  "GitHub Pages": "/perk-logos/githubpages.svg",
  "GitHub Campus Experts": "/perk-logos/github.svg",
  "GitHub Desktop": "/perk-logos/github.svg",
  Octicons: "/perk-logos/github.svg",
  "1Password": "/perk-logos/1password.svg",
  "Visual Studio Dev Essentials": "/perk-logos/visualstudio.svg",
  "Visual Studio Code": "/perk-logos/visualstudiocode.svg",
  Stripe: "/perk-logos/stripe.svg",
  Clerk: "/perk-logos/clerk.svg",
  "Bootstrap Studio": "/perk-logos/bootstrap.svg",
  Arduino: "/perk-logos/arduino.svg",
  "New Relic": "/perk-logos/newrelic.svg",
  Appwrite: "/perk-logos/appwrite.svg",
  Zyte: "/perk-logos/zyte.svg",
  Icons8: "/perk-logos/icons8.svg",
  Sentry: "/perk-logos/sentry.svg",
  Deepnote: "/perk-logos/deepnote.svg",
  Scrimba: "/perk-logos/scrimba.svg",
  GitLens: "/perk-logos/gitkraken.svg",
  Adafruit: "/perk-logos/adafruit.svg",
  "Travis CI": "/perk-logos/travisci.svg",
  "Astra Security": "/perk-logos/astra.svg",
  GitKraken: "/perk-logos/gitkraken.svg",
  CARTO: "/perk-logos/carto.svg",
  Tower: "/perk-logos/tower.svg",
  "Simple Analytics": "/perk-logos/simpleanalytics.svg",
  Codecov: "/perk-logos/codecov.svg",
  Honeybadger: "/perk-logos/honeybadger.svg",
  Vaadin: "/perk-logos/vaadin.svg",
  Themeisle: "/perk-logos/wordpress.svg",
  Dashlane: "/perk-logos/dashlane.svg",
  SymfonyCasts: "/perk-logos/symfony.svg",
};

export function perkLogoSrc(perk) {
  const remote = typeof perk?.logoUrl === "string" ? perk.logoUrl.trim() : "";
  if (/^https:\/\//i.test(remote)) return remote;
  return PERK_LOGOS[perk?.providerName] ?? null;
}

export function perkDisclaimer(providerName) {
  return `Not affiliated with ${providerName}. Terms set by the provider.`;
}

export function formatVerifiedOn(isoDate) {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function perksSchemaMissing(error) {
  const message = error?.message ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    /student_perks|does not exist|could not find the table/i.test(message)
  );
}

export async function fetchActivePerks() {
  const { data, error } = await supabase
    .from("student_perks")
    .select(PERK_COLUMNS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("provider_name", { ascending: true });

  if (error) return { perks: [], error, unavailable: perksSchemaMissing(error) };
  return { perks: (data ?? []).map(mapPerk), error: null, unavailable: false };
}
