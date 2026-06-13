import { supabase } from "./supabaseClient";

/**
 * Resolve the canonical brand assigned to a partner account.
 * Now fetches from the new brands table via partner_profiles.brand_id.
 */
export async function getPartnerBrand(userId) {
  if (!userId) {
    return {
      brandId: null,
      brandName: null,
      error: "Partner account could not be resolved.",
    };
  }

  // Use a join to get the brand details
  const { data: profile, error: profileError } = await supabase
    .from("partner_profiles")
    .select(
      `
      brand_id,
      brand_name,
      brands (
        id,
        name,
        logo_url
      )
    `,
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return {
      brandId: null,
      brandName: null,
      error: profileError.message || "Could not load partner brand.",
    };
  }

  // If we have a linked brand, use it.
  if (profile?.brands?.id) {
    return {
      brandId: profile.brands.id,
      brandName: profile.brands.name,
      logoUrl: profile.brands.logo_url,
      source: "brands_table",
      error: null,
    };
  }

  // Fallback to legacy brand_name if migration hasn't run yet
  if (profile?.brand_name) {
    return {
      brandId: null,
      brandName: profile.brand_name.trim(),
      source: "partner_profiles_legacy",
      error: null,
    };
  }

  return {
    brandId: null,
    brandName: null,
    error:
      "No brand is assigned to this partner account yet. Please contact an admin to be assigned a brand.",
  };
}

export const PARTNER_BRAND_REQUIRED_MESSAGE =
  "No brand is assigned to this partner account yet. Please contact an admin to be assigned a brand before creating deals.";
