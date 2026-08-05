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
      "@id": "https://unideals.co/#website",
      "url": "https://unideals.co/",
      "name": "Uni Deals",
      "description": "Exclusive Student Discounts & Offers in Sri Lanka"
    },
    {
      "@type": "ItemList",
      "itemListElement": [
        {
          "@type": "SiteNavigationElement",
          "position": 1,
          "name": "Explore Deals",
          "url": "https://unideals.co/"
        },
        {
          "@type": "SiteNavigationElement",
          "position": 2,
          "name": "Student Events",
          "url": "https://unideals.co/events"
        },
        {
          "@type": "SiteNavigationElement",
          "position": 3,
          "name": "Student Blog & Guides",
          "url": "https://unideals.co/blog"
        },
        {
          "@type": "SiteNavigationElement",
          "position": 4,
          "name": "Saved Deals",
          "url": "https://unideals.co/saved"
        }
      ]
    }
  ]
}
      `}
    </script>
  );
}
