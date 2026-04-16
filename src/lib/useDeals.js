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

      const { data, error: fetchError } = await supabase
        .from("deals")
        .select("*")
        .order("id", { ascending: true });

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
export function useDeal(id) {
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDeal() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("deals")
        .select("*")
        .eq("id", Number(id))
        .single();

      if (cancelled) return;

      if (fetchError) {
        console.error("[useDeal] Fetch error:", fetchError.message);
        setError(fetchError.message);
        setDeal(null);
        setLoading(false);
        return;
      }

      setDeal(data ? mapDeal(data) : null);
      setLoading(false);
    }

    if (id) fetchDeal();
    return () => { cancelled = true; };
  }, [id]);

  return { deal, loading, error };
}
