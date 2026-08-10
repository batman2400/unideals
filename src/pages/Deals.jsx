/**
 * Deals Page (/deals)
 *
 * Displays deals from Supabase in a filterable grid with
 * Current | Coming Soon tabs. Coming Soon is sorted nearest launch first.
 *
 * Props:
 *   - searchQuery : string — global search text from App state
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useDeals, useSavedDealIds } from "../lib/useDeals";
import { partitionDeals } from "../lib/comingSoon";
import { SITE_URL } from "../lib/seo";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";

const filters = [
  { label: "Show All", value: "all" },
  { label: "Online Only", value: "Online" },
  { label: "In-Store Only", value: "In-Store" },
];

const scheduleTabs = [
  { label: "All", value: "all" },
  { label: "Current", value: "current" },
  { label: "Coming Soon", value: "coming_soon" },
];

function Deals({ searchQuery }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const brandFilter = searchParams.get("brand") || "";
  // ?q= makes this page a real, linkable search-results URL — required for
  // Google's Sitelinks Search Box (see SiteNavigationSchema's SearchAction),
  // and it also falls back to the live text typed into the homepage hero.
  const urlQuery = searchParams.get("q") || "";
  const [queryInput, setQueryInput] = useState(urlQuery);
  const [activeFilter, setActiveFilter] = useState("all");
  const [scheduleTab, setScheduleTab] = useState("all");
  const { deals, loading, error } = useDeals();
  const { savedIds, loading: savedLoading, toggleSave } = useSavedDealIds();

  // Keep the input in sync when the URL changes externally (back/forward nav,
  // or arriving fresh from a Sitelinks Search Box / shared link).
  useEffect(() => {
    setQueryInput(urlQuery);
  }, [urlQuery]);

  const handleQueryChange = (value) => {
    setQueryInput(value);
    const next = new URLSearchParams(searchParams);
    if (value.trim()) {
      next.set("q", value);
    } else {
      next.delete("q");
    }
    setSearchParams(next, { replace: true });
  };

  const clearBrandFilter = () => {
    searchParams.delete("brand");
    setSearchParams(searchParams);
  };

  const { live, comingSoon } = useMemo(() => partitionDeals(deals), [deals]);

  const schedulePool = useMemo(() => {
    if (scheduleTab === "coming_soon") return comingSoon;
    if (scheduleTab === "current") return live;
    return [...live, ...comingSoon];
  }, [scheduleTab, live, comingSoon]);

  // Apply brand filter (from ?brand= param)
  const filteredByBrand = useMemo(
    () =>
      brandFilter
        ? schedulePool.filter(
            (deal) => deal.brand.toLowerCase() === brandFilter.toLowerCase(),
          )
        : schedulePool,
    [brandFilter, schedulePool],
  );

  // Apply type filter
  const filteredByType = useMemo(
    () =>
      activeFilter === "all"
        ? filteredByBrand
        : filteredByBrand.filter((deal) => deal.type === activeFilter),
    [activeFilter, filteredByBrand],
  );

  // Apply search filter on top of type filter — prefer the URL's ?q= (so
  // shared/crawled links and the on-page box work) and fall back to the
  // homepage hero's live search text.
  const normalizedQuery = (urlQuery || searchQuery || "").trim().toLowerCase();

  const filteredDeals = useMemo(() => {
    if (!normalizedQuery) return filteredByType;

    return filteredByType.filter(
      (deal) =>
        deal.title.toLowerCase().includes(normalizedQuery) ||
        deal.brand.toLowerCase().includes(normalizedQuery) ||
        deal.category.toLowerCase().includes(normalizedQuery),
    );
  }, [filteredByType, normalizedQuery]);

  return (
    <section className="max-w-[1440px] mx-auto px-8 py-16">
      <Helmet>
        <title>All Student Deals & Discounts in Sri Lanka | Uni Deals</title>
        <meta
          name="description"
          content="Browse every exclusive student discount on Uni Deals — online promo codes and in-store deals across tech, food, fashion, and more in Sri Lanka."
        />
        {/* Query-param filters (brand, type, schedule) render the same base
            content client-side, so canonicalize to the unfiltered URL to
            avoid duplicate-content signals. */}
        <link rel="canonical" href={`${SITE_URL}/deals`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Uni Deals" />
        <meta property="og:title" content="All Student Deals & Discounts in Sri Lanka | Uni Deals" />
        <meta
          property="og:description"
          content="Browse every exclusive student discount on Uni Deals — online promo codes and in-store deals across tech, food, fashion, and more in Sri Lanka."
        />
        <meta property="og:url" content={`${SITE_URL}/deals`} />
        <meta property="og:image" content={`${SITE_URL}/icon-512-v7.png`} />
      </Helmet>

      {/* Page Header */}
      <div className="mb-12">
        <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-2 block">
          Browse Deals
        </span>
        <h1 className="font-headline font-extrabold text-5xl md:text-6xl tracking-tighter text-on-background mb-4">
          All Student <span className="text-primary italic">Deals.</span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-xl">
          Explore every exclusive offer available to verified students. Filter
          by type to find exactly what you need.
        </p>

        {/* Search box — also the landing target for Google's Sitelinks
            Search Box (?q=), so it must actually filter results below. */}
        <div className="mt-6 max-w-md relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xl">
            search
          </span>
          <input
            type="text"
            value={queryInput}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search deals, brands, categories..."
            aria-label="Search deals"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container-low text-on-background placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
          />
        </div>

        {/* Active brand filter banner */}
        {brandFilter && (
          <div className="mt-4 inline-flex items-center gap-2 bg-primary-container/30 text-primary border border-primary/20 px-4 py-2 rounded-full text-sm font-headline font-bold">
            <span className="material-symbols-outlined text-base">
              storefront
            </span>
            Showing deals from: {brandFilter}
            <button
              onClick={clearBrandFilter}
              className="ml-1 hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )}
      </div>

      {/* Show loader / error */}
      {loading || error ? (
        <DealsLoader loading={loading} error={error} />
      ) : (
        <>
          {/* Current | Coming Soon tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {scheduleTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setScheduleTab(tab.value)}
                className={`px-5 py-2.5 rounded-xl text-sm font-headline font-bold tracking-tight transition-all border ${
                  scheduleTab === tab.value
                    ? tab.value === "coming_soon"
                      ? "bg-sky-600 text-white border-sky-600 shadow-md"
                      : "bg-primary text-on-primary border-primary shadow-md"
                    : "bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 opacity-80 font-normal">
                  (
                  {tab.value === "coming_soon"
                    ? comingSoon.length
                    : tab.value === "current"
                      ? live.length
                      : live.length + comingSoon.length}
                  )
                </span>
              </button>
            ))}
          </div>

          {/* Type filter bar */}
          <div className="flex flex-wrap gap-3 mb-10">
            {filters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                className={`px-6 py-2.5 rounded-full text-sm font-headline font-bold tracking-tight transition-all ${
                  activeFilter === filter.value
                    ? "bg-primary text-on-primary shadow-md"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:shadow-sm border border-outline-variant/20"
                }`}
              >
                {filter.label}
              </button>
            ))}

            <span className="flex items-center text-sm text-on-surface-variant/60 font-body ml-2">
              {filteredDeals.length} deal{filteredDeals.length !== 1 ? "s" : ""}{" "}
              found
              {scheduleTab === "coming_soon" ? " · nearest launch first" : ""}
            </span>
          </div>

          {filteredDeals.length > 0 ? (
            <DealGrid
              deals={filteredDeals}
              savedIds={savedIds}
              onToggleSave={toggleSave}
              savedLoading={savedLoading}
            />
          ) : (
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-6 py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-3">
                {scheduleTab === "coming_soon" ? "schedule" : "local_offer"}
              </span>
              <p className="font-headline font-bold text-lg text-on-background mb-1">
                {scheduleTab === "coming_soon"
                  ? "No coming soon deals"
                  : scheduleTab === "current"
                    ? "No current deals"
                    : "No deals found"}
              </p>
              <p className="text-sm text-on-surface-variant">
                {scheduleTab === "coming_soon"
                  ? "Scheduled launches will show up here, nearest first."
                  : "Try another filter or tab."}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default Deals;
