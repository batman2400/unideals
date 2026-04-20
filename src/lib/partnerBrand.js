import { supabase } from "./supabaseClient";

const MISSING_TABLE_ERROR_CODE = "42P01";

function normalizeBrandName(value) {
  return String(value ?? "").trim();
}

/**
 * Resolve the canonical brand assigned to a partner account.
 *
 * Primary source: partner_profiles.brand_name
 * Fallback source: oldest existing deal for the partner
 */
export async function getPartnerBrandName(userId) {
  if (!userId) {
    return {
      brandName: null,
      source: null,
      error: "Partner account could not be resolved.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("partner_profiles")
    .select("brand_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profileError) {
    return {
      brandName: profile?.brand_name?.trim() || null,
      source: "partner_profiles",
      error: null,
    };
  }

  if (profileError.code !== MISSING_TABLE_ERROR_CODE) {
    return {
      brandName: null,
      source: null,
      error: profileError.message || "Could not load partner brand.",
    };
  }

  // Backward-compatible fallback while older schemas are being migrated.
  const { data: dealRows, error: fallbackError } = await supabase
    .from("deals")
    .select("brand")
    .eq("partner_id", userId)
    .not("brand", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (fallbackError) {
    return {
      brandName: null,
      source: null,
      error: fallbackError.message || "Could not infer partner brand.",
    };
  }

  return {
    brandName: normalizeBrandName(dealRows?.[0]?.brand) || null,
    source: "existing_deals",
    error: null,
  };
}

/**
 * Creates (or updates) the partner's canonical brand profile.
 * Intended for first-time partner onboarding from the partner portal.
 */
export async function upsertPartnerBrandName(userId, brandName) {
  const normalizedBrand = normalizeBrandName(brandName);

  if (!userId) {
    return {
      brandName: null,
      error: "Partner account could not be resolved.",
    };
  }

  if (!normalizedBrand) {
    return {
      brandName: null,
      error: "Brand name is required.",
    };
  }

  const { data, error } = await supabase
    .from("partner_profiles")
    .upsert(
      {
        user_id: userId,
        brand_name: normalizedBrand,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    )
    .select("brand_name")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        brandName: null,
        error: "That brand name is already claimed by another partner.",
      };
    }

    return {
      brandName: null,
      error: error.message || "Could not save partner brand.",
    };
  }

  return {
    brandName: normalizeBrandName(data?.brand_name) || normalizedBrand,
    error: null,
  };
}

export const PARTNER_BRAND_REQUIRED_MESSAGE =
  "No brand is assigned to this partner account yet. Create one from the offer form or ask an admin to assign it.";
