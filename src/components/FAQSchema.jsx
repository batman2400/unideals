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
        "text": "To claim student offers in Sri Lanka, sign up on Uni Deals using your valid university email (.ac.lk). Once verified, you can access exclusive promo codes for online shopping or show your digital student pass at partner stores."
      }
    },
    {
      "@type": "Question",
      "name": "Which brands give student discounts in Sri Lanka?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Uni Deals partners with top brands across Sri Lanka, including major tech retailers, local cafes, clothing stores, and entertainment venues like cinemas. Browse our categories to see all active student discounts."
      }
    },
    {
      "@type": "Question",
      "name": "Is my university email eligible for student deals?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, if you have an active .ac.lk email address from a recognized Sri Lankan university or institute, you are eligible to unlock all student deals on the platform."
      }
    }
  ]
}
      `}
    </script>
  );
}
