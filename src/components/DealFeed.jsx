/**
 * DealFeed — high-density lifestyle explore feed.
 *
 * Sticky-feeling compact search/categories live on Home; this component
 * renders Top Trending Perks (horizontal 4:5 cards) + All Deals (2-col grid).
 */
import { Link } from "react-router-dom";
import { useMemo } from "react";
import DealCard from "./DealCard";
import DealGrid from "./DealGrid";
import DealsLoader from "./DealsLoader";
import { useDeals, useSavedDealIds } from "../lib/useDeals";

function DealFeed({ searchQuery = "" }) {
  const { deals, loading, error } = useDeals();
  const { savedIds, toggleSave, savedLoading } = useSavedDealIds();

  const normalizedQuery = searchQuery.toLowerCase().trim();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return deals;
    return deals.filter(
      (deal) =>
        deal.title?.toLowerCase().includes(normalizedQuery) ||
        deal.brand?.toLowerCase().includes(normalizedQuery) ||
        deal.category?.toLowerCase().includes(normalizedQuery),
    );
  }, [deals, normalizedQuery]);

  if (loading || error) return <DealsLoader loading={loading} error={error} />;

  const isSearching = !!normalizedQuery;
  const TRENDING_LIMIT = 6;
  const trendingDeals = filtered.slice(0, TRENDING_LIMIT);
  const remainingDeals = filtered.slice(TRENDING_LIMIT);
  const allDeals = isSearching
    ? filtered
    : remainingDeals.length > 0
      ? remainingDeals
      : filtered;

  return (
    <div className="max-w-[1440px] mx-auto pb-16">
      {isSearching ? (
        <section className="px-4 md:px-8 pt-6">
          <div className="mb-6">
            <h2 className="font-headline font-extrabold text-2xl tracking-tight md:text-3xl">
              Search Results
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {filtered.length} deal{filtered.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <DealGrid
            deals={filtered}
            enableStagger
            savedIds={savedIds}
            onToggleSave={toggleSave}
            savedLoading={savedLoading}
          />
        </section>
      ) : (
        <>
          {/* Top Trending Perks — horizontal portrait cards */}
          <section className="pt-4 pb-2">
            <div className="px-4 md:px-8 mb-4">
              <h2 className="font-headline font-extrabold text-xl tracking-tight md:text-2xl">
                Top Trending Perks
              </h2>
            </div>

            <div className="flex gap-3 overflow-x-auto px-4 pb-6 md:gap-4 md:px-8 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {trendingDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="w-[58vw] max-w-[280px] flex-shrink-0 sm:w-56 md:w-64"
                >
                  <DealCard
                    deal={deal}
                    variant="hero"
                    isSaved={savedIds ? savedIds.has(deal.id) : undefined}
                    onToggleSave={toggleSave}
                    savedLoading={savedLoading}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* All Deals — dense 2-col image-first grid */}
          <section className="border-t border-outline-variant/10 px-4 pt-6 md:px-8">
            <div className="mb-5 flex items-end justify-between">
              <h2 className="font-headline font-extrabold text-xl tracking-tight md:text-2xl">
                All Deals
              </h2>
              <Link
                to="/perks"
                className="font-headline text-sm font-bold text-on-surface-variant transition-colors hover:text-primary"
              >
                View all →
              </Link>
            </div>

            <DealGrid
              deals={allDeals}
              enableStagger
              savedIds={savedIds}
              onToggleSave={toggleSave}
              savedLoading={savedLoading}
            />
          </section>
        </>
      )}
    </div>
  );
}

export default DealFeed;
