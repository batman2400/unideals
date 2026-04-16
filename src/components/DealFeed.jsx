/**
 * DealFeed Component
 *
 * The "Top Trending Perks" section that displays a grid of DealCards.
 * Now imports deals from the centralized mockData.js and shows the
 * first 6 deals (filtered by search if active).
 *
 * Props:
 *   - searchQuery : string — optional search filter
 */
import { Link } from "react-router-dom";
import deals from "../data/mockData";
import DealCard from "./DealCard";

function DealFeed({ searchQuery }) {
  // Filter by search query if one is active
  const filtered = searchQuery
    ? deals.filter(
        (deal) =>
          deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          deal.brand.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : deals;

  // Show first 6 on the homepage
  const displayDeals = filtered.slice(0, 6);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {displayDeals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </section>
  );
}

export default DealFeed;
