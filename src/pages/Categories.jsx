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

// Demo images for fallback deals
const demoImages = {
  Fashion:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCzOvLNPgk03USFCKNu-GSzr9_dG9Cm3IPn04us2RsA5WNrpv7kXluz1pKVGDoWg25RiLBQB1fB29I5ZtSSxP-VRZO9pTj4_i7YzmJQGsB5rWtNPQYfBMSpYn8ecO1qkcOImTsFwhBvI9d_zwBCanWoMsWcoGglkPVREOwhsLl4333y_W6F-aBfjPfU0jhgJf8o-43sazueipq-nYtKuUCo56Hh3oQ1uWZJ6v_XJep8TPKq9lSRlBs9a7UD7DDWezf0kbdke4zHLvA",
  "Food & Drink":
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDvOrc_ZGFRba9R0_nKoRINZ5tRxNmW-4lIEr_V0GN6gXTnSu7DWgW5rQ4_n0v7d2cmf-H5R-SgaRn5RmvjhFlwbLM5UaZiogKwcUmnk3G4V6a27DcVlGWQMnbwd1mKvUY-y6DAVR9gpxHs9OYCv1EgUKpslQDiRzFMn1Ou0XmJN5NL88ScH4IYQmD-qmZzIgsGr-8rFCDl-9fqQMueV77q82InBqAHqrDWYRIdNQShFMx54sbJnELdQf2gvbkpzZ0HES91UohXj2A",
  "Tech & Mobile":
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCdG-2Jqc1sFEzIzRESXx8K8BItiMhQ7Fe3m2AwiW40ScLzJS5LQ56bEj7jshQCDva9eMVA3JrRls31IJeWBNFPDgcG34uqhvhI22s9ESRnEM9Sj4PrzhV6bT4iYZ_fNn89yaKc9JQ7vEujYUUEPKsmArVBU2fOiY7723xXXQqv1mafUPMNq6AEmiayO1B7SUoBrZ36-V_W_E9mrI_8zAN37_jT-EjpmU0mpdudzYqAiGr_HJIpgtCCHHK492hiHpyw442eXsFueEc",
  "Beauty & Care":
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
  Learning:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBzrewh7Yaxx08JPFCRJjYZ5K9cxEFPyolBeyW8OBhUSI5x-xOOAo9x0RG4oPhNqX8GgKbLiBOnF8dV7M27keE7jCT7Gb1rS3VfkKgVPcA3bj7ZWZ3XPQHy8gFkElPs9lQq95eBonjtM0EUVHkz_SZ7cLVwqn5-H3WSDGf4Eu4kuHf9SpzmdT3GSnV97tcJJYYI6u83KKtolla22Lx0IuvDu7I4gP9ja9hrdmhbGjftDHpBwa_SQX_2k7rNKhnHjcUK9QIMLab3iMs",
  "Travel & Auto":
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
  "Health & Fitness":
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBlQ36ohtoAh9iCNqXOhzdY_i9C66nAuwPjEoY7ATPU7F6ORrkJ9RNozLPw-UlMH_AQ6347sUVdnofSpsAPDPcEDTbHI8kJ-sDd4U4-FL7KtVn0Vid0AKYeDKMnI3_zrZVee7dE003pYw1DkC4gX1Zu8gPPZpyP8zuwQXr8nMXfnT_uQQ8dElkjTXuO7k0Qc_YLrFAX7Ad1UFcbhm5fe5ZOEXLXSjyn2WLYkVCVBMx6LLOVrjorS4brUS3XyKYwP0blJjuevpgSx-Q",
  Household:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAZJkcufRYEZVBJQHpPPMMFRRa666JoWSP--59sPJn-M8ZQeeSSxdKIwlVoClxOXzXBkbWLnBjnSTeu3ZbVd9bwUZrllroLwKliU1H0NZAdsUaTJRWnKE0OtKjq0C6PLsuEeBBaxYg1twgDiskLcyPcjOZjP3IRopDylKF6eRD0uLoKbXdzTR630xOd9-btXTE0Odtm79tP7Gb7goFCqRbK7VMJG-8OxL_V4-SNH5DS_OliUk6NEnRVxzgpXA350ggKALFQL5WQOkg",
  Finance:
    "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
  "Events & Tickets":
    "https://images.unsplash.com/photo-1540039155732-d674d40da4dc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
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

    // Inject demo data for any empty official category
    OFFICIAL_CATEGORIES.forEach((cat) => {
      if (acc[cat].length === 0) {
        acc[cat].push({
          id: `demo-${cat}`,
          title: `Premium ${cat} Brand`,
          brand: `Partner Brand`,
          discount: "Coming Soon",
          type: "Online",
          category: cat,
          imageUrl: demoImages[cat],
          description: `We're partnering with top brands to bring you the best ${cat} deals. Check back soon!`,
          redemptionCode: "DEMO2026",
          storeUrl: "#",
        });
      }
    });

    return acc;
  }, [deals]);

  // Use all official categories since demo data guarantees they're populated
  const categoryNames = OFFICIAL_CATEGORIES;

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
