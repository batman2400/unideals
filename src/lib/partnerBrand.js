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
      category: null,
      error: "Partner account could not be resolved.",
    };
  }

  // Use a join to get the brand details including category
  const { data: profile, error: profileError } = await supabase
    .from("partner_profiles")
    .select(
      `
      brand_id,
      brand_name,
      brands (
        id,
        name,
        logo_url,
        category
      )
    `,
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return {
      brandId: null,
      brandName: null,
      category: null,
      error: profileError.message || "Could not load partner brand.",
    };
  }

  // If we have a linked brand, use it. Ignore brands(*) when brand_id is
  // missing — that join can otherwise surface an unrelated row (e.g. UniDeals).
  if (profile?.brand_id && profile?.brands?.id === profile.brand_id) {
    return {
      brandId: profile.brands.id,
      brandName: profile.brands.name,
      logoUrl: profile.brands.logo_url,
      category: profile.brands.category || null,
      source: "brands_table",
      error: null,
    };
  }

  if (profile?.brand_id && Array.isArray(profile.brands)) {
    const match = profile.brands.find((brand) => brand?.id === profile.brand_id);
    if (match?.id) {
      return {
        brandId: match.id,
        brandName: match.name,
        logoUrl: match.logo_url,
        category: match.category || null,
        source: "brands_table",
        error: null,
      };
    }
  }

  // Fallback 1: If profile has brand_id but join did not return brand object
  if (profile?.brand_id) {
    const { data: directBrand } = await supabase
      .from("brands")
      .select("id, name, logo_url, category")
      .eq("id", profile.brand_id)
      .maybeSingle();

    if (directBrand?.id) {
      return {
        brandId: directBrand.id,
        brandName: directBrand.name,
        logoUrl: directBrand.logo_url,
        category: directBrand.category || null,
        source: "brands_table",
        error: null,
      };
    }
  }

  // Fallback 2: If profile has legacy brand_name but no brand_id
  if (profile?.brand_name) {
    const { data: namedBrand } = await supabase
      .from("brands")
      .select("id, name, logo_url, category")
      .ilike("name", profile.brand_name.trim())
      .maybeSingle();

    if (namedBrand?.id) {
      return {
        brandId: namedBrand.id,
        brandName: namedBrand.name,
        logoUrl: namedBrand.logo_url,
        category: namedBrand.category || null,
        source: "brands_table",
        error: null,
      };
    }
  }

  return {
    brandId: null,
    brandName: null,
    category: null,
    error:
      "No brand is assigned to this partner account yet. Please contact an admin to be assigned a brand.",
  };
}

export const PARTNER_BRAND_REQUIRED_MESSAGE =
  "No brand is assigned to this partner account yet. Please contact an admin to be assigned a brand before creating deals.";

export { formatScannedCode } from "./scannedPayload.js";
