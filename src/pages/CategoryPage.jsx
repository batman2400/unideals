/**
 * CategoryPage (/category/:categoryId)
 *
 * Dedicated, crawlable landing page for a single deal category — a much
 * stronger SEO target than a client-side filter on /categories (clean
 * URL, unique <title>/description, canonical, breadcrumb + ItemList
 * structured data, and real deal content instead of a placeholder).
 */
import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useDeals, useSavedDealIds } from "../lib/useDeals";
import { isComingSoonDeal } from "../lib/comingSoon";
import { slugify, SITE_URL } from "../lib/seo";
import {
  OFFICIAL_CATEGORIES,
  CATEGORY_META,
  CATEGORY_DESCRIPTIONS,
  OLD_TO_NEW_CATEGORY,
} from "../lib/categories";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";
import BreadcrumbSchema from "../components/BreadcrumbSchema";
import ItemListSchema from "../components/ItemListSchema";

export default function CategoryPage() {
  const { categoryId } = useParams();
  const { deals, loading, error } = useDeals();
  const { savedIds, loading: savedLoading, toggleSave } = useSavedDealIds();

  // Resolve the slug back to a real category name — prefer the official
  // taxonomy so URLs stay stable even when a category has 0 deals yet.
  const categoryName = useMemo(() => {
    const officialMatch = OFFICIAL_CATEGORIES.find(
      (name) => slugify(name) === categoryId,
    );
    if (officialMatch) return officialMatch;

    // Fall back to whatever category text actually exists on live deals
    // (covers legacy/custom category strings not yet in the taxonomy).
    const liveMatch = deals.find(
      (deal) => slugify(OLD_TO_NEW_CATEGORY[deal.category] || deal.category) === categoryId,
    );
    return liveMatch
      ? OLD_TO_NEW_CATEGORY[liveMatch.category] || liveMatch.category
      : null;
  }, [categoryId, deals]);

  const categoryDeals = useMemo(() => {
    if (!categoryName) return [];
    return deals.filter((deal) => {
      const normalized = OLD_TO_NEW_CATEGORY[deal.category] || deal.category;
      return normalized === categoryName && !isComingSoonDeal(deal);
    });
  }, [deals, categoryName]);

  const canonicalUrl = `${SITE_URL}/category/${categoryId}`;
  const meta = CATEGORY_META[categoryName] || { icon: "category", color: "text-primary" };

  // Unknown slug — no official or live category matches it.
  if (!loading && !categoryName) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 md:px-8 py-16 text-center">
        <Helmet>
          <title>Category Not Found | Uni Deals</title>
          <meta name="robots" content="noindex, follow" />
        </Helmet>
        <h1 className="font-headline font-extrabold text-3xl mb-3">
          Category Not Found
        </h1>
        <p className="text-on-surface-variant mb-8">
          We couldn&apos;t find that category. Browse all categories instead.
        </p>
        <Link to="/categories" className="text-primary font-bold hover:underline">
          View All Categories
        </Link>
      </div>
    );
  }

  const title = categoryName
    ? `${categoryName} Student Discounts & Offers in Sri Lanka | Uni Deals`
    : "Student Discounts by Category | Uni Deals";
  const description =
    (categoryName && CATEGORY_DESCRIPTIONS[categoryName]) ||
    `Find the best ${categoryName || ""} student discounts and offers in Sri Lanka. Unlock exclusive deals with your verified university email.`;
  const hasDeals = categoryDeals.length > 0;

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-16">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        {!loading && !hasDeals && <meta name="robots" content="noindex, follow" />}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Uni Deals" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={`${SITE_URL}/icon-512-v5.png`} />
      </Helmet>

      {categoryName && (
        <>
          <BreadcrumbSchema
            items={[
              { name: "Home", url: `${SITE_URL}/` },
              { name: "Categories", url: `${SITE_URL}/categories` },
              { name: categoryName, url: canonicalUrl },
            ]}
          />
          {hasDeals && (
            <ItemListSchema
              name={`${categoryName} Student Discounts`}
              items={categoryDeals.map((deal) => ({
                name: `${deal.brand} — ${deal.discount || deal.title}`,
                url: `${SITE_URL}/deals/${deal.id}`,
              }))}
            />
          )}
        </>
      )}

      {/* Breadcrumb nav (visible) */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-on-surface-variant/70">
        <Link to="/" className="hover:text-primary transition-colors">Home</Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <Link to="/categories" className="hover:text-primary transition-colors">Categories</Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="font-bold text-on-surface">{categoryName || "..."}</span>
      </nav>

      <div className="mb-10 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center flex-shrink-0">
          <span className={`material-symbols-outlined text-3xl ${meta.color}`}>
            {meta.icon}
          </span>
        </div>
        <div>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tight text-on-background">
            {categoryName || "Category"} Student Discounts
          </h1>
          <p className="text-on-surface-variant text-base mt-1 max-w-2xl">
            {description}
          </p>
        </div>
      </div>

      {loading || error ? (
        <DealsLoader loading={loading} error={error} />
      ) : hasDeals ? (
        <DealGrid
          deals={categoryDeals}
          savedIds={savedIds}
          onToggleSave={toggleSave}
          savedLoading={savedLoading}
        />
      ) : (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-6 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-3">
            {meta.icon}
          </span>
          <p className="font-headline font-bold text-lg text-on-background mb-1">
            No {categoryName} deals right now
          </p>
          <p className="text-sm text-on-surface-variant mb-6">
            Check back soon, or explore all current offers.
          </p>
          <Link
            to="/deals"
            className="inline-flex items-center gap-2 rounded-lg emerald-gradient px-6 py-2.5 font-headline text-sm font-bold text-on-primary shadow-sm hover:shadow-md transition-all"
          >
            Browse All Deals
          </Link>
        </div>
      )}

      <div className="mt-16 pt-8 border-t border-outline-variant/15 text-center">
        <Link to="/categories" className="text-primary font-bold hover:underline">
          View All Categories
        </Link>
      </div>
    </div>
  );
}
