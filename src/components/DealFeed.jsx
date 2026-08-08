/**
 * DealFeed Component
 *
 * The "Top Trending Perks" section that displays a grid of DealCards.
 * Fetches deals from Supabase and shows the first 6
 * (filtered by search if active).
 *
 * Props:
 *   - searchQuery : string — optional search filter
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

  const normalizedQuery = searchQuery.toLowerCase();
  const filtered = useMemo(() => {
    return deals.filter(
      (deal) =>
        deal.title.toLowerCase().includes(normalizedQuery) ||
        deal.brand.toLowerCase().includes(normalizedQuery)
    );
  }, [deals, normalizedQuery]);

  if (loading || error) return <DealsLoader loading={loading} error={error} />;

  const isSearching = !!normalizedQuery;
  const TRENDING_LIMIT = 6;
  const trendingDeals = filtered.slice(0, TRENDING_LIMIT);
  // Only deals beyond the trending row — when there are ≤6 total, show all
  // so "All Deals" is never an empty "No deals found" state.
  const remainingDeals = filtered.slice(TRENDING_LIMIT);
  const allDeals = isSearching
    ? filtered
    : remainingDeals.length > 0
      ? remainingDeals
      : filtered;

  return (
    <div className="max-w-[1440px] mx-auto pb-16">
      {/* Search Mode just shows grid */}
      {isSearching ? (
        <section className="px-6 md:px-8 pt-8">
          <div className="mb-8">
            <h2 className="font-headline font-extrabold text-3xl tracking-tight">
              Search Results
            </h2>
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
          {/* Trending Deals (Horizontal Peek Row) */}
          <section className="pt-8 pb-4">
            <div className="px-6 md:px-8 flex justify-between items-end mb-6">
              <div>
                <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-1 block">
                  Curated Selection
                </span>
                <h2 className="font-headline font-extrabold text-3xl tracking-tight">
                  Top Trending Perks
                </h2>
              </div>
            </div>

            {/* Horizontal Swipeable Container */}
            <div className="flex overflow-x-auto gap-4 px-6 md:px-8 pb-8 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {trendingDeals.map((deal) => (
                <div 
                  key={deal.id} 
                  className="w-[85vw] md:w-72 flex-shrink-0"
                >
                  <DealCard
                    deal={deal}
                    isSaved={savedIds ? savedIds.has(deal.id) : undefined}
                    onToggleSave={toggleSave}
                    savedLoading={savedLoading}
                    compactImage={true}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* All Deals Grid */}
          <section className="px-6 md:px-8 pt-8 border-t border-outline-variant/10">
            <div className="flex justify-between items-end mb-8">
              <h2 className="font-headline font-extrabold text-3xl tracking-tight">
                All Deals
              </h2>
              <Link
                to="/perks"
                className="text-on-surface-variant font-headline font-bold text-sm hover:text-primary transition-colors"
              >
                View all &rarr;
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
