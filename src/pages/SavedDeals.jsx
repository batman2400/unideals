import { Link } from "react-router-dom";
import { useDeals } from "../lib/useDeals";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";

export default function SavedDeals() {
  const { deals, loading: dealsLoading, error: dealsError, savedDealIds, savedLoading, savedError } = useDeals();

  const savedDeals = deals.filter((d) => savedDealIds.has(d.id));

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
