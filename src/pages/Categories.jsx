/**
 * Categories Page (/categories)
 *
 * Groups all deals by their `category` field and renders
 * each group as a titled section with its own DealGrid.
 * Fetches from Supabase.
 */
import { useDeals } from "../lib/useDeals";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";

// Category metadata — icon + colour accent for each section header
const categoryMeta = {
  Tech:     { icon: "laptop_mac",       color: "text-blue-500" },
  Coffee:   { icon: "coffee",           color: "text-amber-600" },
  Clothing: { icon: "apparel",          color: "text-pink-500" },
  Fitness:  { icon: "fitness_center",   color: "text-orange-500" },
  Home:     { icon: "home",             color: "text-teal-500" },
  Creative: { icon: "palette",          color: "text-purple-500" },
};

function Categories() {
  const { deals, loading, error } = useDeals();

  // Group deals by category
  const grouped = deals.reduce((acc, deal) => {
    if (!acc[deal.category]) acc[deal.category] = [];
    acc[deal.category].push(deal);
    return acc;
  }, {});

  const categoryNames = Object.keys(grouped);

  return (
    <section className="max-w-[1440px] mx-auto px-8 py-16">
      {/* Page Header */}
      <div className="mb-16">
        <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-2 block">
          Organized for You
        </span>
        <h1 className="font-headline font-extrabold text-5xl md:text-6xl tracking-tighter text-on-background mb-4">
          Deals by <span className="text-primary italic">Category.</span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-xl">
          Find student deals sorted by what matters to you — from tech and
          coffee to fitness and fashion.
        </p>
      </div>

      {/* Show loader / error */}
      {(loading || error) ? (
        <DealsLoader loading={loading} error={error} />
      ) : (
        /* Category Sections */
        categoryNames.map((cat, idx) => {
          const meta = categoryMeta[cat] || { icon: "category", color: "text-primary" };
          return (
            <div key={cat} className="mb-20">
              {/* Section divider (skip for first) */}
              {idx > 0 && (
                <div className="border-t border-outline-variant/15 mb-12" />
              )}

              {/* Section header */}
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center">
                  <span className={`material-symbols-outlined text-2xl ${meta.color}`}>
                    {meta.icon}
                  </span>
                </div>
                <div>
                  <h2 className="font-headline font-extrabold text-3xl tracking-tight">
                    {cat}
                  </h2>
                  <p className="text-on-surface-variant/60 text-sm">
                    {grouped[cat].length} deal{grouped[cat].length !== 1 ? "s" : ""} available
                  </p>
                </div>
              </div>

              <DealGrid deals={grouped[cat]} />
            </div>
          );
        })
      )}
    </section>
  );
}

export default Categories;
