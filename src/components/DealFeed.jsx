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
import { useDeals } from "../lib/useDeals";
import DealGrid from "./DealGrid";
import DealsLoader from "./DealsLoader";

function DealFeed({ searchQuery }) {
  const { deals, loading, error } = useDeals();

  // Compute derived lists on every render to keep hook ordering stable.
  const normalizedQuery = (searchQuery ?? "").trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return deals;

    return deals.filter(
      (deal) =>
        deal.title.toLowerCase().includes(normalizedQuery)
        || deal.brand.toLowerCase().includes(normalizedQuery)
    );
  }, [deals, normalizedQuery]);

  // Show first 6 on the homepage
  const displayDeals = useMemo(() => filtered.slice(0, 6), [filtered]);

  // Show loader / error
  if (loading || error) return <DealsLoader loading={loading} error={error} />;

  return (
    <section className="max-w-[1440px] mx-auto px-8 py-16">
      {/* Section Header */}
      <div className="flex justify-between items-end mb-12">
        <div>
          <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-2 block">
            Curated Selection
          </span>
          <h2 className="font-headline font-extrabold text-4xl tracking-tight">
            Top Trending Perks
          </h2>
        </div>
        <Link
          to="/perks"
          className="text-on-surface-variant font-headline font-bold text-sm border-b border-outline-variant/50 pb-1 hover:text-primary transition-colors"
        >
          View all offers
        </Link>
      </div>

      {/* Deal Cards Grid */}
      <DealGrid deals={displayDeals} enableStagger />
    </section>
  );
}

export default DealFeed;
