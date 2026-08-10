/**
 * ItemListSchema — schema.org ItemList structured data for a page that
 * lists multiple deals (category / brand landing pages). Strengthens
 * Google's understanding of listing pages beyond plain HTML links.
 */
export default function ItemListSchema({ name, items }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: item.url,
      name: item.name,
    })),
  };

  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
}
