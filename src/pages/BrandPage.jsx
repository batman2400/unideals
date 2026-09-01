/**
 * BrandPage (/brand/:brandId)
 *
 * Dedicated, crawlable landing page for a single partner brand — replaces
 * the previous placeholder stub with real deal content, a clean canonical
 * URL, and Organization/BreadcrumbList/ItemList structured data.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useDeals, useSavedDealIds } from "../lib/useDeals";
import { isComingSoonDeal } from "../lib/comingSoon";
import { slugify, SITE_URL, DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_WIDTH, DEFAULT_OG_IMAGE_HEIGHT } from "../lib/seo";
import { supabase } from "../lib/supabaseClient";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";
import BreadcrumbSchema from "../components/BreadcrumbSchema";
import ItemListSchema from "../components/ItemListSchema";

export default function BrandPage() {
  const { brandId } = useParams();
  const { deals, loading, error } = useDeals();
  const { savedIds, loading: savedLoading, toggleSave } = useSavedDealIds();
  const [brandRecord, setBrandRecord] = useState(undefined);

  useEffect(() => {
    let cancelled = false;

    async function loadBrand() {
      const { data, error: brandError } = await supabase
        .from("brands")
        .select("id, name, logo_url, description, category, website_url");

      if (cancelled) return;

      if (brandError || !Array.isArray(data)) {
        setBrandRecord(null);
        return;
      }

      const match = data.find((row) => slugify(row.name) === brandId);
      setBrandRecord(match || null);
    }

    setBrandRecord(undefined);
    loadBrand();
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  // Prefer the brands table (works even with 0 live deals). Fall back to
  // deal.brand so a slug still resolves if the table fetch fails.
  const brandName = useMemo(() => {
    if (brandRecord?.name) return brandRecord.name;
    const match = deals.find((deal) => slugify(deal.brand) === brandId);
    return match ? match.brand : null;
  }, [brandRecord, deals, brandId]);

  const brandDeals = useMemo(() => {
    if (!brandName) return [];
    return deals.filter((deal) => deal.brand === brandName);
  }, [deals, brandName]);

  const liveDeals = useMemo(
    () => brandDeals.filter((deal) => !isComingSoonDeal(deal)),
    [brandDeals],
  );
  const comingSoonDeals = useMemo(
    () => brandDeals.filter((deal) => isComingSoonDeal(deal)),
    [brandDeals],
  );

  const canonicalUrl = `${SITE_URL}/brand/${brandId}`;
  const brandsResolved = brandRecord !== undefined;
  const pageLoading = !brandName && (loading || !brandsResolved);

  if (!pageLoading && !brandName) {
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
    ? `Get exclusive ${brandName} student discounts and promo codes in Sri Lanka with your verified university email. ${brandDeals.length} offer${brandDeals.length !== 1 ? "s" : ""} available.`
    : "Get exclusive student discounts and promo codes in Sri Lanka.";
  const hasDeals = brandDeals.length > 0;
  const brandImage =
    brandRecord?.logo_url ||
    brandDeals[0]?.imageUrl ||
    brandDeals[0]?.image_url ||
    DEFAULT_OG_IMAGE;

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-16">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        {/* Known brand pages stay indexable; only the not-found state above is noindex. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Uni Deals" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={brandImage} />
        {brandImage === DEFAULT_OG_IMAGE ? (
          <>
            <meta property="og:image:width" content={DEFAULT_OG_IMAGE_WIDTH} />
            <meta property="og:image:height" content={DEFAULT_OG_IMAGE_HEIGHT} />
          </>
        ) : null}
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
          {brandRecord?.description || description}
        </p>
      </div>

      {pageLoading || error ? (
        <DealsLoader loading={pageLoading} error={error} />
      ) : hasDeals ? (
        <div className="space-y-10">
          {liveDeals.length > 0 && (
            <section>
              <DealGrid
                deals={liveDeals}
                savedIds={savedIds}
                onToggleSave={toggleSave}
                savedLoading={savedLoading}
              />
            </section>
          )}
          {comingSoonDeals.length > 0 && (
            <section>
              <h2 className="font-headline font-bold text-xl mb-4 text-on-background">
                Coming Soon
              </h2>
              <DealGrid
                deals={comingSoonDeals}
                savedIds={savedIds}
                onToggleSave={toggleSave}
                savedLoading={savedLoading}
              />
            </section>
          )}
        </div>
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
