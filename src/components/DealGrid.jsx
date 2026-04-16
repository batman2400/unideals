/**
 * DealGrid Component
 *
 * A reusable grid that renders a list of DealCards.
 * Used on the Perks page, Categories page, and anywhere
 * you need a grid of deals.
 *
 * Props:
 *   - deals : array of deal objects from mockData.js
 */
import DealCard from "./DealCard";

function DealGrid({ deals }) {
  if (!deals || deals.length === 0) {
    return (
      <div className="text-center py-20">
        <span className="material-symbols-outlined text-6xl text-outline-variant/30 mb-4 block">
          sentiment_dissatisfied
        </span>
        <p className="text-on-surface-variant/60 font-headline font-bold text-lg">
          No deals found
        </p>
        <p className="text-on-surface-variant/40 text-sm mt-1">
          Try adjusting your filters or search.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
      {deals.map((deal) => (
        <DealCard key={deal.id} deal={deal} />
      ))}
    </div>
  );
}

export default DealGrid;
