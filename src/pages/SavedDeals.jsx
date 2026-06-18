import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useDeals } from "../lib/useDeals";
import { useRoleContext } from "../lib/RoleContext";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";

export default function SavedDeals() {
  const { deals, loading: dealsLoading, error: dealsError } = useDeals();
  const { user } = useRoleContext();

  const [savedDealIds, setSavedDealIds] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState(null);

  useEffect(() => {
    let active = true;
    async function fetchSaved() {
      if (!user) {
        setSavedError(null);
        setSavedLoading(false);
        return;
      }
      setSavedLoading(true);
      setSavedError(null);
      const { data, error } = await supabase
        .from("saved_deals")
        .select("deal_id")
        .eq("user_id", user.id);
      
      if (active && !error) {
        setSavedDealIds(data ? data.map((d) => d.deal_id) : []);
        setSavedError(null);
        setSavedLoading(false);
      } else if (active && error) {
        setSavedError(error.message || "Could not load your saved deals.");
        setSavedLoading(false);
      }
    }
    fetchSaved();
    return () => {
      active = false;
    };
  }, [user]);

  const savedDeals = deals.filter((d) => savedDealIds.includes(d.id));

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

      {dealsLoading || dealsError || savedLoading ? (
        <DealsLoader
          loading={dealsLoading || savedLoading}
          error={dealsError || savedError}
        />
      ) : (
        <DealGrid deals={savedDeals} />
      )}
    </div>
  );
}
