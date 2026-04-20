/**
 * useDeals Hook
 *
 * Reusable hook for fetching deals from Supabase.
 * Returns { deals, loading, error } state.
 *
 * Supabase returns snake_case columns (image_url, redemption_code, store_url)
 * so we map them to camelCase to keep frontend components unchanged.
 *
 * Usage:
 *   const { deals, loading, error } = useDeals();
 */
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

/**
 * Maps a Supabase row (snake_case) to the frontend deal shape (camelCase).
 */
function mapDeal(row) {
  return {
    id: row.id,
    title: row.title,
    brand: row.brand,
    discount: row.discount,
    type: row.type,
    category: row.category,
    imageUrl: row.image_url,
    description: row.description,
    redemptionCode: row.redemption_code,
    storeUrl: row.store_url,
  };
}

export function useDeals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDeals() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc("get_public_deals");

      if (cancelled) return;

      if (fetchError) {
        console.error("[useDeals] Fetch error:", fetchError.message);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setDeals((data || []).map(mapDeal));
      setLoading(false);
    }

    fetchDeals();
    return () => { cancelled = true; };
  }, []);

  return { deals, loading, error };
}

/**
 * Fetch a single deal by ID from Supabase.
 */
export function useDeal(id, accessKey = "") {
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDeal() {
      setLoading(true);
      setError(null);

      const parsedId = Number(id);
      if (!Number.isFinite(parsedId)) {
        setDeal(null);
        setError("Invalid deal id.");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase.rpc("get_public_deal_by_id", {
        target_deal_id: parsedId,
      });

      if (cancelled) return;

      if (fetchError) {
        console.error("[useDeal] Fetch error:", fetchError.message);
        setError(fetchError.message);
        setDeal(null);
        setLoading(false);
        return;
      }

      const row = Array.isArray(data) ? (data[0] ?? null) : data;
      setDeal(row ? mapDeal(row) : null);
      setLoading(false);
    }

    if (id) fetchDeal();
    return () => { cancelled = true; };
  }, [id, accessKey]);

  return { deal, loading, error };
}

/**
 * ── Phase 3: Saved Deals Helper Functions ──────────────
 */

export async function saveDeal(dealId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be logged in to save a deal");
  
  const { error } = await supabase
    .from("saved_deals")
    .insert([{ user_id: user.id, deal_id: dealId }]);
    
  if (error) {
    console.error("[saveDeal] Error:", error.message);
    throw error;
  }
}

export async function unsaveDeal(dealId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be logged in to unsave a deal");
  
  const { error } = await supabase
    .from("saved_deals")
    .delete()
    .eq("user_id", user.id)
    .eq("deal_id", dealId);
    
  if (error) {
    console.error("[unsaveDeal] Error:", error.message);
    throw error;
  }
}

export async function checkIfSaved(dealId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  
  const { data, error } = await supabase
    .from("saved_deals")
    .select("deal_id")
    .eq("user_id", user.id)
    .eq("deal_id", dealId)
    .maybeSingle(); // maybeSingle returns null if 0 rows, instead of throwing PGRST116
    
  if (error) {
    console.error("[checkIfSaved] Error:", error.message);
    throw error;
  }
  
  return !!data;
}
