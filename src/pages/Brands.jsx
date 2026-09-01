/**
 * Brands Page (/brands)
 *
 * Partner directory — shows a card for each unique brand
 * derived from Supabase deals, with deal count and a link to
 * view their deals.
 */
import { Link, useSearchParams } from "react-router-dom";
import { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useDeals } from "../lib/useDeals";
import { slugify, SITE_URL } from "../lib/seo";
import DealsLoader from "../components/DealsLoader";

function Brands() {
  const { deals, loading, error } = useDeals();
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") || "").trim();

  // Build a map of unique brands with their deals
  const brands = useMemo(() => {
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

    return Object.values(brandMap);
  }, [deals]);

  const visibleBrands = useMemo(() => {
    if (!query) return brands;
    const needle = query.toLowerCase();
    return brands.filter(
      (brand) =>
        brand.name.toLowerCase().includes(needle) ||
        brand.category?.toLowerCase().includes(needle),
    );
  }, [brands, query]);

  return (
    <section className="max-w-[1440px] mx-auto px-8 py-16">
      <Helmet>
        <title>Top Brand Student Discounts in Sri Lanka | Uni Deals</title>
        <meta
          name="description"
          content="Browse every partner brand offering exclusive student discounts on Uni Deals — from tech and fashion to food and fitness, all across Sri Lanka."
        />
        <link rel="canonical" href={`${SITE_URL}/brands`} />
      </Helmet>
      
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
        {query ? (
          <p className="mt-4 text-sm text-on-surface-variant">
            Showing matches for “{query}”.{" "}
            <Link to="/brands" className="font-bold text-primary hover:underline">
              Clear
            </Link>
          </p>
        ) : null}
      </div>

      {/* Show loader / error */}
      {loading || error ? (
        <DealsLoader loading={loading} error={error} />
      ) : visibleBrands.length === 0 && query ? (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-6 py-16 text-center">
          <p className="font-headline font-bold text-lg text-on-background mb-1">
            No brands match “{query}”
          </p>
          <p className="text-sm text-on-surface-variant mb-6">
            Try another name, or browse the full directory.
          </p>
          <Link
            to="/brands"
            className="inline-flex items-center gap-2 rounded-lg emerald-gradient px-6 py-2.5 font-headline text-sm font-bold text-on-primary shadow-sm hover:shadow-md transition-all"
          >
            Browse all brands
          </Link>
        </div>
      ) : (
        /* Brand Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {visibleBrands.map((brand, index) => (
            <div
              key={brand.name}
              className="group bg-surface-container-low rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 border border-outline-variant/10 animate-stagger-in"
              style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
            >
              {/* Brand image */}
              <div className="aspect-[16/9] overflow-hidden bg-surface-container">
                <img
                  src={brand.imageUrl}
                  alt={brand.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
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
                  {brand.deals.length} exclusive deal
                  {brand.deals.length !== 1 ? "s" : ""}
                </p>

                <Link
                  to={`/brand/${slugify(brand.name)}`}
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
