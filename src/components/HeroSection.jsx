/**
 * HeroSection Component
 *
 * A dynamic, auto-rotating hero carousel with 4 themed slides.
 * Features:
 *   - Crossfade + blur transitions between slides
 *   - Auto-advance every 5 seconds with progress bar
 *   - Pause on hover for accessibility
 *   - Manual dot navigation
 *   - Search bar pinned below the carousel
 *   - Fully responsive
 *
 * Props:
 *   - searchQuery    : string — current search text
 *   - onSearchChange : function — updates search text
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDeals } from "../lib/useDeals";
import { resolveBrandExplorePath } from "../lib/seo";

const SLIDE_INTERVAL = 5000; // 5 seconds per slide

const slides = [
  {
    id: 1,
    headline: "Exclusive Student",
    headlineAccent: "Deals.",
    subtext:
      "Verified student offers in Sri Lanka — in-store and online. New partners land here as they join.",
    cta: "Browse All Deals",
    link: "/deals",
    icon: "school",
    gradient: "from-[#29695b] to-[#1a5c4f]",
    accentColor: "#afefdd",
    bgAccent:
      "radial-gradient(ellipse at 20% 80%, rgba(175,239,221,0.15) 0%, transparent 60%)",
  },
  {
    id: 2,
    headline: "Fresh Drops",
    headlineAccent: "Weekly.",
    subtext:
      "Partner brands drop offers as they go live. Check Deals and Events for what is on right now.",
    cta: "See What's New",
    link: "/deals",
    icon: "local_fire_department",
    gradient: "from-[#c7522a] to-[#e8734a]",
    accentColor: "#ffd4c4",
    bgAccent:
      "radial-gradient(ellipse at 80% 20%, rgba(199,82,42,0.1) 0%, transparent 60%)",
  },
  {
    id: 3,
    headline: "Top Brands,",
    headlineAccent: "Zero Hassle.",
    subtext:
      "Local partner brands with student pricing. Open a deal, verify once, then redeem.",
    cta: "Explore Brands",
    link: "/brands",
    icon: "verified",
    gradient: "from-[#2d5aa0] to-[#4a7fd4]",
    accentColor: "#c4deff",
    bgAccent:
      "radial-gradient(ellipse at 70% 70%, rgba(45,90,160,0.1) 0%, transparent 60%)",
  },
  {
    id: 4,
    headline: "In-Store Perks",
    headlineAccent: "Near You.",
    subtext:
      "In-store offers use a timed ticket from the deal page — the cashier scans that, not your student pass.",
    cta: "Find In-Store Deals",
    link: "/deals",
    icon: "storefront",
    gradient: "from-[#7c4dab] to-[#a872d9]",
    accentColor: "#e4d4ff",
    bgAccent:
      "radial-gradient(ellipse at 30% 30%, rgba(124,77,171,0.1) 0%, transparent 60%)",
  },
];

function HeroSection({ searchQuery, onSearchChange }) {
  const navigate = useNavigate();
  const { deals } = useDeals();
  const brandNames = useMemo(
    () => deals.map((deal) => deal.brand).filter(Boolean),
    [deals],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [exitIndex, setExitIndex] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const exitTimeoutRef = useRef(null);

  const goToSlide = useCallback(
    (nextIndex) => {
      if (nextIndex === activeIndex) return;
      setExitIndex(activeIndex);
      setActiveIndex(nextIndex);
      // Clear exit slide after animation completes
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = setTimeout(() => setExitIndex(null), 500);
    },
    [activeIndex],
  );

  const nextSlide = useCallback(() => {
    goToSlide((activeIndex + 1) % slides.length);
  }, [activeIndex, goToSlide]);

  // Auto-rotation timer
  useEffect(() => {
    if (isPaused) {
      clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(nextSlide, SLIDE_INTERVAL);
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(exitTimeoutRef.current);
    };
  }, [isPaused, nextSlide]);

  // Reset progress bar animation on slide change
  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.animation = "none";
      // Force reflow
      void progressRef.current.offsetHeight;
      progressRef.current.style.animation = "";
    }
  }, [activeIndex]);

  const handleSearchSubmit = () => {
    navigate(resolveBrandExplorePath(searchQuery, brandNames));
  };

  const currentSlide = slides[activeIndex];
  const exitSlide = exitIndex !== null ? slides[exitIndex] : null;

  return (
    <section
      className="max-w-[1440px] mx-auto px-6 md:px-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ── Slide Carousel ──────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl min-h-[220px] md:min-h-[200px] lg:min-h-[240px] mt-4 md:mt-6"
        style={{ background: currentSlide.bgAccent }}
      >
        {/* Exit slide (fading out) */}
        {exitSlide && (
          <div
            key={`exit-${exitSlide.id}`}
            className="hero-slide-exit flex flex-col justify-center px-6 md:px-12 py-6 h-full"
            style={{ background: exitSlide.bgAccent }}
          >
            <SlideContent slide={exitSlide} navigate={navigate} />
          </div>
        )}

        {/* Active slide (fading in) */}
        <div
          key={`active-${currentSlide.id}`}
          className="hero-slide-active flex flex-col justify-center px-6 md:px-12 py-6 h-full"
        >
          <SlideContent slide={currentSlide} navigate={navigate} />
        </div>

        {/* ── Bottom Bar: Dots + Progress ───────────────── */}
        <div className="absolute bottom-0 left-0 right-0 px-6 md:px-12 pb-4 flex items-center gap-4">
          {/* Dot navigation */}
          <div className="flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goToSlide(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? "w-8 h-2.5 bg-primary shadow-sm"
                    : "w-2.5 h-2.5 bg-on-surface-variant/20 hover:bg-on-surface-variant/40"
                }`}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="flex-1 h-0.5 bg-outline-variant/15 rounded-full overflow-hidden">
            <div
              ref={progressRef}
              className="h-full bg-primary/50 rounded-full hero-progress-bar"
              style={{
                animationDuration: `${SLIDE_INTERVAL}ms`,
                animationPlayState: isPaused ? "paused" : "running",
              }}
            />
          </div>

          {/* Slide counter */}
          <span className="text-xs font-headline font-bold text-on-surface-variant/40 tabular-nums tracking-wider">
            {String(activeIndex + 1).padStart(2, "0")} /{" "}
            {String(slides.length).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* ── Search Bar (fixed below slides) ─────────────── */}
      <div className="w-full max-w-2xl mx-auto mt-10 md:mt-12">
        <div className="mb-3 flex items-baseline justify-between gap-3 pl-1">
          <label
            htmlFor="home-brand-search"
            className="block text-xs font-bold tracking-[0.2em] text-on-surface-variant uppercase"
          >
            Explore your favourite brands
          </label>
          <button
            type="button"
            onClick={() => navigate("/brands")}
            className="text-xs font-headline font-bold text-primary hover:underline shrink-0"
          >
            Browse all
          </button>
        </div>
        <div className="flex items-center border-b border-outline-variant/30 pb-4">
          <input
            id="home-brand-search"
            className="bg-transparent border-none w-full text-2xl font-headline placeholder:text-on-surface-variant/30 focus:ring-0 px-0"
            placeholder="e.g. Spa Ceylon"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearchSubmit();
            }}
          />
          <button
            type="button"
            onClick={handleSearchSubmit}
            aria-label="Explore brands"
            className="text-primary p-2 hover:scale-110 active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-4xl">
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── Individual Slide Content ──────────────────────────── */
function SlideContent({ slide, navigate }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full pb-6 md:pb-8">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1.5 md:mb-2">
          <span
            className="material-symbols-outlined text-base md:text-lg"
            style={{
              color: slide.accentColor,
              fontVariationSettings: "'FILL' 1",
            }}
          >
            {slide.icon}
          </span>
          <span
            className="text-[10px] md:text-xs font-headline font-bold uppercase tracking-[0.15em]"
            style={{ color: slide.accentColor }}
          >
            {slide.cta}
          </span>
        </div>

        <h2 className="font-headline font-extrabold text-2xl md:text-3xl lg:text-4xl tracking-tight text-on-background mb-1 md:mb-2 max-w-xl leading-tight">
          {slide.headline}{" "}
          <span className="italic text-primary">{slide.headlineAccent}</span>
        </h2>

        <p className="text-on-surface-variant text-xs md:text-sm max-w-lg leading-snug line-clamp-2 md:line-clamp-none">
          {slide.subtext}
        </p>
      </div>

      <button
        onClick={() => navigate(slide.link)}
        className="inline-flex items-center justify-center gap-2 w-full md:w-auto emerald-gradient text-on-primary px-5 py-2.5 rounded-xl font-headline font-bold text-xs md:text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.97] transition-all whitespace-nowrap mt-2 md:mt-0"
      >
        {slide.cta}
        <span className="material-symbols-outlined text-sm md:text-base">arrow_forward</span>
      </button>
    </div>
  );
}

export default HeroSection;
