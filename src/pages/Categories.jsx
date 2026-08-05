/**
 * Categories Page (/categories)
 *
 * Groups all deals by their `category` field and renders
 * each group as a titled section with its own DealGrid.
 * Syncs active category with the `filter` URL search param.
 * Fetches from Supabase.
 *
 * V1 — 10 official categories with URL-decoded filter support.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useDeals, useSavedDealIds } from "../lib/useDeals";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";

// Official V1 category taxonomy
const OFFICIAL_CATEGORIES = [
  "Fashion",
  "Food & Drink",
  "Tech & Mobile",
  "Beauty & Care",
  "Learning",
  "Travel & Auto",
  "Health & Fitness",
  "Household",
  "Finance",
  "Events & Tickets",
];

// Category metadata — icon + colour accent for each section header
const categoryMeta = {
  Fashion: { icon: "checkroom", color: "text-pink-500" },
  "Food & Drink": { icon: "restaurant", color: "text-amber-600" },
  "Tech & Mobile": { icon: "smartphone", color: "text-blue-500" },
  "Beauty & Care": { icon: "spa", color: "text-rose-400" },
  Learning: { icon: "school", color: "text-indigo-500" },
  "Travel & Auto": { icon: "flight", color: "text-sky-500" },
  "Health & Fitness": { icon: "fitness_center", color: "text-orange-500" },
  Household: { icon: "home", color: "text-teal-500" },
  Finance: { icon: "account_balance", color: "text-emerald-500" },
  "Events & Tickets": { icon: "confirmation_number", color: "text-purple-500" },
};

// Migration map: old placeholder categories → new V1 names
const OLD_TO_NEW = {
  Tech: "Tech & Mobile",
  Coffee: "Food & Drink",
  Clothing: "Fashion",
  Fitness: "Health & Fitness",
  Home: "Household",
  Creative: "Learning",
};


function Categories() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { deals, loading, error } = useDeals();
  const { savedIds, loading: savedLoading, toggleSave } = useSavedDealIds();
  const [activeCategory, setActiveCategory] = useState("all");

  // Group deals by category, injecting demo data for empty ones
  const grouped = useMemo(() => {
    const acc = {};

    // Initialize all official categories to ensure they exist
    OFFICIAL_CATEGORIES.forEach((cat) => {
      acc[cat] = [];
    });

    // Populate actual deals
    deals.forEach((deal) => {
      const cat = OLD_TO_NEW[deal.category] || deal.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(deal);
    });

    return acc;
  }, [deals]);

  // Only show categories that actually have deals
  const categoryNames = OFFICIAL_CATEGORIES.filter(cat => grouped[cat] && grouped[cat].length > 0);

  // Decode the URL filter param — handles both encoded (%26) and raw (&)
  useEffect(() => {
    const filterParam = searchParams.get("filter");

    if (!filterParam) {
      setActiveCategory("all");
      return;
    }

    const matchedCategory = OFFICIAL_CATEGORIES.find(
      (category) => category.toLowerCase() === filterParam.toLowerCase(),
    );

    setActiveCategory(matchedCategory || "all");
  }, [searchParams]);

  const handleCategoryChange = (category) => {
    setActiveCategory(category);

    if (category === "all") {
      setSearchParams({});
      return;
    }

    setSearchParams({ filter: category });
  };

  const visibleCategories =
    activeCategory === "all"
      ? categoryNames
      : categoryNames.filter((category) => category === activeCategory);

  const getCategoryTitle = () => {
    switch (activeCategory) {
      case "Tech & Mobile": return "Student Laptop & Tech Offers Sri Lanka | Uni Deals";
      case "Food & Drink": return "Cheap Food & Restaurant Offers for Students in Colombo | Uni Deals";
      case "Travel & Auto": return "University Student Flight & Travel Discounts | Uni Deals";
      case "all": return "All Student Discounts by Category | Uni Deals";
      default: return `${activeCategory} Student Discounts Sri Lanka | Uni Deals`;
    }
  };

  return (
    <section className="max-w-[1440px] mx-auto px-8 py-16">
      <Helmet>
        <title>{getCategoryTitle()}</title>
      </Helmet>

      {/* Page Header */}
      <div className="mb-16">
        <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-2 block">
          Organized for You
        </span>
        <h1 className="font-headline font-extrabold text-5xl md:text-6xl tracking-tighter text-on-background mb-4">
          Deals by <span className="text-primary italic">Category.</span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-xl">
          Find student deals sorted by what matters to you — from fashion and
          food to tech and events.
        </p>

        {/* Category Filter Tabs */}
        {!loading && !error && categoryNames.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-8">
            <button
              onClick={() => handleCategoryChange("all")}
              className={`px-6 py-2.5 rounded-full text-sm font-headline font-bold tracking-tight transition-all ${
                activeCategory === "all"
                  ? "bg-primary text-on-primary shadow-md"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-outline-variant/20"
              }`}
            >
              All Categories
            </button>

            {OFFICIAL_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
                className={`px-6 py-2.5 rounded-full text-sm font-headline font-bold tracking-tight transition-all ${
                  activeCategory === category
                    ? "bg-primary text-on-primary shadow-md"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-outline-variant/20"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Show loader / error */}
      {loading || error ? (
        <DealsLoader loading={loading} error={error} />
      ) : (
        /* Category Sections */
        visibleCategories.map((cat, idx) => {
          const meta = categoryMeta[cat] || {
            icon: "category",
            color: "text-primary",
          };
          return (
            <div key={cat} className="mb-20">
              {/* Section divider (skip for first) */}
              {idx > 0 && (
                <div className="border-t border-outline-variant/15 mb-12" />
              )}

              {/* Section header */}
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center">
                  <span
                    className={`material-symbols-outlined text-2xl ${meta.color}`}
                  >
                    {meta.icon}
                  </span>
                </div>
                <div>
                  <h2 className="font-headline font-extrabold text-3xl tracking-tight">
                    {cat}
                  </h2>
                  <p className="text-on-surface-variant/60 text-sm">
                    {grouped[cat].length} deal
                    {grouped[cat].length !== 1 ? "s" : ""} available
                  </p>
                </div>
              </div>

              <DealGrid
                deals={grouped[cat]}
                savedIds={savedIds}
                onToggleSave={toggleSave}
                savedLoading={savedLoading}
              />
            </div>
          );
        })
      )}
    </section>
  );
}

export default Categories;
