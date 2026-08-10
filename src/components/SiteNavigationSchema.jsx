import React from 'react';

export default function SiteNavigationSchema() {
  return (
    <script type="application/ld+json">
      {`
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://www.unideals.co/#website",
      "url": "https://www.unideals.co/",
      "name": "Uni Deals",
      "description": "Exclusive Student Discounts & Offers in Sri Lanka",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://www.unideals.co/deals?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "ItemList",
      "itemListElement": [
        {
          "@type": "SiteNavigationElement",
          "position": 1,
          "name": "Explore",
          "url": "https://www.unideals.co/"
        },
        {
          "@type": "SiteNavigationElement",
          "position": 2,
          "name": "Student Deals",
          "url": "https://www.unideals.co/deals"
        },
        {
          "@type": "SiteNavigationElement",
          "position": 3,
          "name": "Student Events",
          "url": "https://www.unideals.co/events"
        },
        {
          "@type": "SiteNavigationElement",
          "position": 4,
          "name": "Student Blog & Guides",
          "url": "https://www.unideals.co/blog"
        },
        {
          "@type": "SiteNavigationElement",
          "position": 5,
          "name": "Categories",
          "url": "https://www.unideals.co/categories"
        },
        {
          "@type": "SiteNavigationElement",
          "position": 6,
          "name": "Brands",
          "url": "https://www.unideals.co/brands"
        }
      ]
    }
  ]
}
      `}
    </script>
  );
}
