import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { unsaveDeal, usePublicDealsByIds } from "../lib/useDeals";
import { useRoleContext } from "../lib/RoleContext";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";

export default function SavedDeals() {
  const { user } = useRoleContext();
  const userId = user?.id ?? null;

  const [savedDealIds, setSavedDealIds] = useState([]);
  const [savedLoading, setSavedLoading] = useState(Boolean(userId));
  const [savedError, setSavedError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSaved() {
      if (!userId) {
        setSavedDealIds([]);
        setSavedError(null);
        setSavedLoading(false);
        return;
      }

      setSavedLoading(true);
      setSavedError(null);

      const { data, error } = await supabase
        .from("saved_deals")
        .select("deal_id")
        .eq("user_id", userId);

      if (cancelled) return;

      if (error) {
        setSavedError(error.message || "Could not load your saved deals.");
        setSavedDealIds([]);
        setSavedLoading(false);
        return;
      }

      setSavedDealIds(
        (data ?? [])
          .map((row) => Number(row.deal_id))
          .filter((id) => Number.isInteger(id) && id > 0),
      );
      setSavedLoading(false);
    }

    fetchSaved();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const { dealsById, loading: detailsLoading } = usePublicDealsByIds(savedDealIds);

  const savedDeals = useMemo(
    () => savedDealIds.map((id) => dealsById[id]).filter(Boolean),
    [savedDealIds, dealsById],
  );

  const savedIdSet = useMemo(() => new Set(savedDealIds), [savedDealIds]);

  const toggleSave = useCallback(async (dealId) => {
    await unsaveDeal(dealId);
    setSavedDealIds((previous) => previous.filter((id) => id !== Number(dealId)));
  }, []);

  const loading = savedLoading || detailsLoading;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background">
            Saved Deals
          </h1>
          <p className="text-on-surface-variant text-base mt-2">
            Your bookmarked offers — ready when you are.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-outline-variant/40 hover:bg-surface-container text-sm font-headline font-bold text-on-surface-variant transition-all active:scale-[0.98] w-fit"
        >
          Browse more{" "}
          <span className="material-symbols-outlined text-[18px]">
            arrow_forward
          </span>
        </Link>
      </div>

      {loading ? (
        <DealsLoader loading error={null} />
      ) : savedError ? (
        <DealsLoader loading={false} error={savedError} />
      ) : (
        <DealGrid
          deals={savedDeals}
          savedIds={savedIdSet}
          onToggleSave={toggleSave}
          emptyTitle="Nothing saved yet"
          emptyMessage="Tap the heart on a deal to keep it here."
        />
      )}
    </div>
  );
}
