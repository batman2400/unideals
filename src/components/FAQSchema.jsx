import React from 'react';

export const DEFAULT_HOME_FAQS = [
  {
    question: "How do I claim student offers in Sri Lanka?",
    answer: "Sign up on Uni Deals, then verify from your Profile. Entering the verification code sent to your university email (.ac.lk or campus domain) verifies you immediately. School students and anyone without an institute email upload a student ID for manual admin review. Once verified, online deals reveal a promo code and in-store deals generate a timed redemption ticket on your phone."
  },
  {
    question: "Which brands give student discounts in Sri Lanka?",
    answer: "Browse Deals, Brands, and Categories on Uni Deals for live offers from partners including Spa Ceylon, Tea Avenue, and leading tech, fashion, dining, and wellness brands across Sri Lanka. New discounts are regularly added for verified students."
  },
  {
    question: "Is my university email eligible for student deals?",
    answer: "Institute emails (.ac.lk, .edu, and listed campus domains like SLIIT, NSBM, IIT, KDU, Moratuwa, Colombo, and others) are verified instantly with a one-time code. Gmail and school students can verify by uploading a student ID for quick admin review."
  },
  {
    question: "How long is my student verification valid?",
    answer: "Student verification on Uni Deals is valid for 12 months from approval. You can easily renew your verification every year as long as you are an active student."
  }
];

export default function FAQSchema({ items = DEFAULT_HOME_FAQS }) {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": items.map((item) => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
}

