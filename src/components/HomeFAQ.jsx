import { useState } from "react";
import FAQSchema, { DEFAULT_HOME_FAQS } from "./FAQSchema";

export default function HomeFAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleItem = (idx) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-16 border-t border-outline-variant/20">
      <FAQSchema items={DEFAULT_HOME_FAQS} />
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-xs font-bold tracking-[0.25em] text-primary uppercase mb-2 inline-block">
            Frequently Asked Questions
          </span>
          <h2 className="font-headline font-extrabold text-3xl md:text-4xl text-on-background tracking-tight">
            Got Questions? We’ve Got Answers.
          </h2>
          <p className="text-on-surface-variant text-sm md:text-base mt-2">
            Everything you need to know about unlocking student deals and perks across Sri Lanka.
          </p>
        </div>

        <div className="space-y-3">
          {DEFAULT_HOME_FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.question}
                className="bg-surface-container-low border border-outline-variant/20 rounded-2xl overflow-hidden transition-all duration-200 hover:border-primary/40"
              >
                <button
                  type="button"
                  onClick={() => toggleItem(idx)}
                  className="w-full flex items-center justify-between gap-4 p-5 md:p-6 text-left cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                >
                  <span className="font-headline font-bold text-base md:text-lg text-on-surface">
                    {faq.question}
                  </span>
                  <span
                    className={`material-symbols-outlined text-primary text-2xl shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    expand_more
                  </span>
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    className="px-5 md:px-6 pb-5 md:pb-6 pt-0 text-on-surface-variant text-sm md:text-base leading-relaxed border-t border-outline-variant/10 animate-fade-in"
                  >
                    <p className="pt-3">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
