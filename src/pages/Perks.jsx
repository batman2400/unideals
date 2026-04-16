/**
 * Perks Page (/perks)
 *
 * Displays ALL deals from Supabase in a filterable grid.
 * Users can filter by type (Show All / Online Only / In-Store Only)
 * and results also respond to the global search query.
 *
 * Props:
 *   - searchQuery : string — global search text from App state
 */
import { useState } from "react";
import { useDeals } from "../lib/useDeals";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";

const filters = [
  { label: "Show All", value: "all" },
  { label: "Online Only", value: "Online" },
  { label: "In-Store Only", value: "In-Store" },
];

function Perks({ searchQuery }) {
  const [activeFilter, setActiveFilter] = useState("all");
  const { deals, loading, error } = useDeals();

  // Apply type filter
  const filteredByType =
    activeFilter === "all"
      ? deals
      : deals.filter((deal) => deal.type === activeFilter);

  // Apply search filter on top of type filter
  const filteredDeals = searchQuery
    ? filteredByType.filter(
        (deal) =>
          deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          deal.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
          deal.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredByType;

  return (
    <section className="max-w-[1440px] mx-auto px-8 py-16">
      {/* Page Header */}
      <div className="mb-12">
        <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-2 block">
          Browse Deals
        </span>
        <h1 className="font-headline font-extrabold text-5xl md:text-6xl tracking-tighter text-on-background mb-4">
          All Student <span className="text-primary italic">Perks.</span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-xl">
          Explore every exclusive offer available to verified students. Filter by
          type to find exactly what you need.
        </p>
      </div>

      {/* Show loader / error */}
      {(loading || error) ? (
        <DealsLoader loading={loading} error={error} />
      ) : (
        <>
          {/* Filter Bar */}
          <div className="flex flex-wrap gap-3 mb-10">
            {filters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                className={`px-6 py-2.5 rounded-full text-sm font-headline font-bold tracking-tight transition-all ${
                  activeFilter === filter.value
                    ? "bg-primary text-on-primary shadow-md"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-outline-variant/20"
                }`}
              >
                {filter.label}
              </button>
            ))}

            {/* Active filter count */}
            <span className="flex items-center text-sm text-on-surface-variant/60 font-body ml-2">
              {filteredDeals.length} deal{filteredDeals.length !== 1 ? "s" : ""} found
            </span>
          </div>

          {/* Deal Grid */}
          <DealGrid deals={filteredDeals} />
        </>
      )}
    </section>
  );
}

export default Perks;
