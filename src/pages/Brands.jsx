/**
 * Brands Page (/brands)
 *
 * Partner directory — shows a card for each unique brand
 * derived from Supabase deals, with deal count and a link to
 * view their deals.
 */
import { Link } from "react-router-dom";
import { useDeals } from "../lib/useDeals";
import DealsLoader from "../components/DealsLoader";

function Brands() {
  const { deals, loading, error } = useDeals();

  // Build a map of unique brands with their deals
  const brandMap = deals.reduce((acc, deal) => {
    if (!acc[deal.brand]) {
      acc[deal.brand] = {
        name: deal.brand,
        category: deal.category,
        deals: [],
        imageUrl: deal.imageUrl,
      };
    }
    acc[deal.brand].deals.push(deal);
    return acc;
  }, {});

  const brands = Object.values(brandMap);

  return (
    <section className="max-w-[1440px] mx-auto px-8 py-16">
      {/* Page Header */}
      <div className="mb-16">
        <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-2 block">
          Our Network
        </span>
        <h1 className="font-headline font-extrabold text-5xl md:text-6xl tracking-tighter text-on-background mb-4">
          Partner <span className="text-primary italic">Directory.</span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-xl">
          Meet the brands that bring exclusive perks to students like you.
        </p>
      </div>

      {/* Show loader / error */}
      {(loading || error) ? (
        <DealsLoader loading={loading} error={error} />
      ) : (
        /* Brand Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {brands.map((brand) => (
            <div
              key={brand.name}
              className="group bg-surface-container-low rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 border border-outline-variant/10"
            >
              {/* Brand image */}
              <div className="aspect-[16/9] overflow-hidden bg-surface-container">
                <img
                  src={brand.imageUrl}
                  alt={brand.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>

              {/* Brand info */}
              <div className="p-6">
                {/* Category badge */}
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-primary bg-primary-container/30 px-3 py-1 rounded-full mb-3">
                  {brand.category}
                </span>

                <h3 className="font-headline font-extrabold text-xl tracking-tight text-on-background mb-1">
                  {brand.name}
                </h3>
                <p className="text-on-surface-variant text-sm mb-4">
                  {brand.deals.length} exclusive deal{brand.deals.length !== 1 ? "s" : ""}
                </p>

                <Link
                  to="/perks"
                  className="inline-flex items-center gap-1 text-primary font-headline font-bold text-sm hover:gap-2 transition-all"
                >
                  View Deals
                  <span className="material-symbols-outlined text-lg">
                    arrow_forward
                  </span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default Brands;
