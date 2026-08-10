/**
 * BreadcrumbSchema — schema.org BreadcrumbList structured data.
 *
 * Helps Google render breadcrumb trails in search results and reinforces
 * the site's information architecture for crawlers.
 *
 * Usage:
 *   <BreadcrumbSchema items={[
 *     { name: "Home", url: "https://www.unideals.co/" },
 *     { name: "Deals", url: "https://www.unideals.co/deals" },
 *     { name: "Domino's", url: "https://www.unideals.co/deals/12" },
 *   ]} />
 */
export default function BreadcrumbSchema({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
}
