import React from "react";

const SITE_URL = "https://www.unideals.co";
const FALLBACK_IMAGE = `${SITE_URL}/icon-512-v5.png`;

/**
 * DealOfferSchema — schema.org Offer structured data for a single
 * /perks/:id deal page.
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
  const hasStoreUrl = typeof storeUrl === "string" && storeUrl !== "#" && storeUrl.length > 0;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: title,
    description:
      description ||
      `Exclusive ${brand} student discount for verified Sri Lankan university students, available on Uni Deals.`,
    category: category || undefined,
    url: canonicalUrl,
    image: imageUrl || FALLBACK_IMAGE,
    availability: "https://schema.org/InStock",
    seller: {
      "@type": "Organization",
      name: brand,
      ...(hasStoreUrl ? { url: storeUrl } : {}),
    },
    areaServed: {
      "@type": "Country",
      name: "Sri Lanka",
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
  };

  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
}
