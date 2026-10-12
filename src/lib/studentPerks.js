import { supabase } from "./supabaseClient";

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
