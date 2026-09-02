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
import { isExpiredDeal } from "./comingSoon";

/**
 * Maps a Supabase row (snake_case) to the frontend deal shape (camelCase).
 */
export function mapDeal(row) {
  return {
    id: row.id,
    title: row.title,
    brand: row.brand,
    discount: row.discount,
    type: row.type,
    category: row.category,
    imageUrl: row.image_url,
    description: row.description,
    // Public deal-load RPCs may still include this until the Play cutover
    // SQL. Students unlock codes only via reveal_online_deal_code.
    redemptionCode: undefined,
    storeUrl: row.store_url,
    // Optional — only present if the RPC's return set includes them.
    // Dates are null from public RPCs when the partner hid them.
    startTime: row.start_time ?? null,
    endTime: row.end_time ?? null,
    showStartDate: !!row.show_start_date,
    showEndDate: !!row.show_end_date,
    // Leave undefined when the RPC omits the flag so helpers can fall back to dates.
    isComingSoon:
      row.is_coming_soon == null ? undefined : !!row.is_coming_soon,
    isExpired: row.is_expired == null ? undefined : !!row.is_expired,
  };
}

export function useDeals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timeout = null;

    async function fetchDeals() {
      setLoading(true);
      setError(null);

      timeout = setTimeout(() => {
        if (cancelled) return;
        setError((prev) => prev || "Deals took too long to load.");
        setLoading(false);
      }, 15000);

      const { data, error: fetchError } =
        await supabase.rpc("get_public_deals");

      clearTimeout(timeout);
      if (cancelled) return;

      if (fetchError) {
        console.error("[useDeals] Fetch error:", fetchError.message);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const rows = Array.isArray(data) ? data : [];
      setDeals(rows.map(mapDeal).filter((deal) => !isExpiredDeal(deal)));
      setLoading(false);
    }

    fetchDeals();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
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

      const { data, error: fetchError } = await supabase.rpc(
        "get_public_deal_by_id",
        {
          target_deal_id: parsedId,
        },
      );

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
    return () => {
      cancelled = true;
    };
  }, [id, accessKey]);

  return { deal, loading, error };
}

/**
 * Fetch specific public deals by id (blog `[deal:123]` embeds).
 * Uses the same RPC as the deal page so unpublished/expired rows stay hidden.
 */
export function usePublicDealsByIds(ids) {
  const key = Array.isArray(ids) && ids.length
    ? [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].join(",")
    : "";
  const [dealsById, setDealsById] = useState({});
  const [loading, setLoading] = useState(Boolean(key));

  useEffect(() => {
    if (!key) {
      setDealsById({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    const parsedIds = key.split(",").map(Number);
    setLoading(true);

    Promise.all(
      parsedIds.map(async (id) => {
        const { data, error: fetchError } = await supabase.rpc(
          "get_public_deal_by_id",
          { target_deal_id: id },
        );
        if (fetchError) {
          console.error("[usePublicDealsByIds]", id, fetchError.message);
          return [id, null];
        }
        const row = Array.isArray(data) ? (data[0] ?? null) : data;
        return [id, row ? mapDeal(row) : null];
      }),
    ).then((entries) => {
      if (cancelled) return;
      setDealsById(Object.fromEntries(entries));
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      console.error("[usePublicDealsByIds]", err);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { dealsById, loading };
}

/**
 * ── Phase 3: Saved Deals Helper Functions ──────────────
 */

export async function saveDeal(dealId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

/**
 * ── Batch Saved Deals Hook ─────────────────────────────
 *
 * Fetches ALL saved deal IDs for the current user in a single query.
 * Returns a Set for O(1) lookup, plus a toggle function.
 * This replaces the N+1 pattern where each DealCard queried individually.
 */
export function useSavedDealIds() {
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchAllSaved() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setSavedIds(new Set());
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("saved_deals")
        .select("deal_id")
        .eq("user_id", user.id);

      if (!cancelled) {
        if (error) {
          console.error("Failed to load saved deals:", error);
        } else if (data) {
          setSavedIds(new Set(data.map((r) => r.deal_id)));
        }
        setLoading(false);
      }
    }

    fetchAllSaved();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSave = async (dealId) => {
    const wasSaved = savedIds.has(dealId);
    if (wasSaved) {
      await unsaveDeal(dealId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(dealId);
        return next;
      });
    } else {
      await saveDeal(dealId);
      setSavedIds((prev) => new Set(prev).add(dealId));
    }
    return !wasSaved;
  };

  return { savedIds, loading, toggleSave };
}
