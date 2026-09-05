import { SITE_URL, DEFAULT_OG_IMAGE } from "../lib/seo";
import { asHttpUrl } from "../lib/httpUrl";

const FALLBACK_IMAGE = DEFAULT_OG_IMAGE;

/**
 * DealOfferSchema — schema.org Offer structured data for a single
 * /deals/:id deal page.
 *
 * Note: schema.org does not define a "DiscountOffer" type — `Offer` is the
 * correct, spec-compliant vocabulary for a merchant discount/promo code.
 * Google does not currently guarantee a dedicated "coupon" rich result for
 * this type, but it strengthens entity/merchant context for the page and is
 * a prerequisite if Product-wrapped merchant listings are added later.
 */
export default function DealOfferSchema({ deal, canonicalUrl }) {
  if (!deal) return null;

  const {
    title,
    brand,
    description,
    category,
    type,
    imageUrl,
    storeUrl,
    startTime,
    endTime,
    showStartDate,
    showEndDate,
  } = deal;

  const isInStore = type === "In-Store";
  const safeStoreUrl = asHttpUrl(storeUrl);
  const hasStoreUrl = !!safeStoreUrl;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${brand} - ${title || "Student Discount"}`,
    description:
      description ||
      `Exclusive ${brand} student discount for verified Sri Lankan university students, available on Uni Deals.`,
    category: category || "Student Deals",
    url: canonicalUrl,
    image: imageUrl || FALLBACK_IMAGE,
    brand: {
      "@type": "Brand",
      name: brand,
      ...(hasStoreUrl ? { url: safeStoreUrl } : {}),
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "LKR",
      availability: "https://schema.org/InStock",
      url: canonicalUrl,
      seller: {
        "@type": "Organization",
        name: brand,
        ...(hasStoreUrl ? { url: safeStoreUrl } : {}),
      },
      areaServed: {
        "@type": "Country",
        name: "Sri Lanka",
      },
      eligibleRegion: {
        "@type": "Country",
        name: "Sri Lanka",
      },
      eligibleCustomerType: {
        "@type": "Audience",
        audienceType: "Verified Sri Lankan university students",
      },
      additionalProperty: [
        {
          "@type": "PropertyValue",
          name: "Fulfillment Method",
          value: isInStore ? "In-Store Redemption" : "Online Redemption",
        },
        {
          "@type": "PropertyValue",
          name: "Eligibility",
          value: "Verified Sri Lankan university students (.ac.lk email required)",
        },
      ],
      ...(isInStore
        ? { availableAtOrFrom: { "@type": "Place", name: `${brand} Stores in Sri Lanka` } }
        : {}),
      ...(showStartDate && startTime ? { validFrom: startTime } : {}),
      ...(showEndDate && endTime ? { validThrough: endTime } : {}),
    },
  };

  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
}
