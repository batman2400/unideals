/**
 * BrandPage (/brand/:brandId)
 *
 * Dedicated, crawlable landing page for a single partner brand — replaces
 * the previous placeholder stub with real deal content, a clean canonical
 * URL, and Organization/BreadcrumbList/ItemList structured data.
 */
import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useDeals, useSavedDealIds } from "../lib/useDeals";
import { isComingSoonDeal } from "../lib/comingSoon";
import { slugify, SITE_URL } from "../lib/seo";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";
import BreadcrumbSchema from "../components/BreadcrumbSchema";
import ItemListSchema from "../components/ItemListSchema";

export default function BrandPage() {
  const { brandId } = useParams();
  const { deals, loading, error } = useDeals();
  const { savedIds, loading: savedLoading, toggleSave } = useSavedDealIds();

  // Resolve the slug back to the brand's real, original-cased name by
  // matching against live deal data (brands have no dedicated slug column).
  const brandName = useMemo(() => {
    const match = deals.find((deal) => slugify(deal.brand) === brandId);
    return match ? match.brand : null;
  }, [deals, brandId]);

  const brandDeals = useMemo(() => {
    if (!brandName) return [];
    return deals.filter(
      (deal) => deal.brand === brandName && !isComingSoonDeal(deal),
    );
  }, [deals, brandName]);

  const canonicalUrl = `${SITE_URL}/brand/${brandId}`;

  if (!loading && !brandName) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 md:px-8 py-16 text-center">
        <Helmet>
          <title>Brand Not Found | Uni Deals</title>
          <meta name="robots" content="noindex, follow" />
        </Helmet>
        <h1 className="font-headline font-extrabold text-3xl mb-3">
          Brand Not Found
        </h1>
        <p className="text-on-surface-variant mb-8">
          We couldn&apos;t find that brand. Browse our full partner directory instead.
        </p>
        <Link to="/brands" className="text-primary font-bold hover:underline">
          View All Partner Brands
        </Link>
      </div>
    );
  }

  const title = brandName
    ? `${brandName} Student Discount in Sri Lanka | Uni Deals`
    : "Student Discount | Uni Deals";
  const description = brandName
    ? `Get exclusive ${brandName} student discounts and promo codes in Sri Lanka with your verified university email. ${brandDeals.length} active offer${brandDeals.length !== 1 ? "s" : ""}.`
    : "Get exclusive student discounts and promo codes in Sri Lanka.";
  const hasDeals = brandDeals.length > 0;
  const brandImage = brandDeals[0]?.imageUrl || `${SITE_URL}/icon-512-v5.png`;

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
        <meta property="og:image" content={brandImage} />
      </Helmet>

      {brandName && (
        <>
          <BreadcrumbSchema
            items={[
              { name: "Home", url: `${SITE_URL}/` },
              { name: "Brands", url: `${SITE_URL}/brands` },
              { name: brandName, url: canonicalUrl },
            ]}
          />
          {hasDeals && (
            <ItemListSchema
              name={`${brandName} Student Discounts`}
              items={brandDeals.map((deal) => ({
                name: deal.discount || deal.title,
                url: `${SITE_URL}/deals/${deal.id}`,
              }))}
            />
          )}
        </>
      )}

      <nav className="mb-6 flex items-center gap-2 text-sm text-on-surface-variant/70">
        <Link to="/" className="hover:text-primary transition-colors">Home</Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <Link to="/brands" className="hover:text-primary transition-colors">Brands</Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="font-bold text-on-surface">{brandName || "..."}</span>
      </nav>

      <div className="mb-10">
        <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tight text-on-background mb-2">
          {brandName || "Brand"} Student Offers
        </h1>
        <p className="text-on-surface-variant text-base max-w-2xl">
          {description}
        </p>
      </div>

      {loading || error ? (
        <DealsLoader loading={loading} error={error} />
      ) : hasDeals ? (
        <DealGrid
          deals={brandDeals}
          savedIds={savedIds}
          onToggleSave={toggleSave}
          savedLoading={savedLoading}
        />
      ) : (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-6 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-3">
            storefront
          </span>
          <p className="font-headline font-bold text-lg text-on-background mb-1">
            No {brandName} deals right now
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
        <Link to="/brands" className="text-primary font-bold hover:underline">
          View All Partner Brands
        </Link>
      </div>
    </div>
  );
}
