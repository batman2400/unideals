import React from 'react';

export default function FAQSchema() {
  return (
    <script type="application/ld+json">
      {`
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I claim student offers in Sri Lanka?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sign up on Uni Deals, then verify from Profile. Institute emails use a one-time code to prove inbox ownership; school students upload ID. An admin must approve before you can redeem — a university email alone does not verify you. Online deals then reveal a promo code; in-store deals generate a timed ticket on the deal page."
      }
    },
    {
      "@type": "Question",
      "name": "Which brands give student discounts in Sri Lanka?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Browse Deals, Brands, and Categories on Uni Deals for every live student offer. The catalogue grows as partner brands join — check the site for what is available now."
      }
    },
    {
      "@type": "Question",
      "name": "Is my university email eligible for student deals?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Institute emails (.ac.lk, .edu, and other listed campuses) can prove inbox ownership with a one-time code, then upload student ID for admin review. Gmail and school students use the manual ID path. Eligibility is confirmed only after an admin approves."
      }
    }
  ]
}
      `}
    </script>
  );
}
