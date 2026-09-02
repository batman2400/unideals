/**
 * HeroSection Component
 *
 * A dynamic, auto-rotating hero carousel with 4 themed slides.
 * Features:
 *   - Horizontal GPU slide (no blur / scale jitter)
 *   - Auto-advance every 5 seconds with progress bar
 *   - Pause on hover for accessibility
 *   - Swipe / drag plus manual dot navigation
 *   - Search bar pinned below the carousel
 *   - Fully responsive
 *
 * Props:
 *   - searchQuery    : string — current search text
 *   - onSearchChange : function — updates search text
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDeals } from "../lib/useDeals";
import { resolveBrandExplorePath } from "../lib/seo";

const SLIDE_INTERVAL = 5000;
const SWIPE_THRESHOLD_PX = 48;
const SLIDE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const SLIDE_MS = 480;

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
    accentColor: "#e4d4ff",
    bgAccent:
      "radial-gradient(ellipse at 30% 30%, rgba(124,77,171,0.1) 0%, transparent 60%)",
  },
];

const SLIDE_COUNT = slides.length;
const TRACK_SLIDES = [slides[SLIDE_COUNT - 1], ...slides, slides[0]];

function displayIndexFromTrack(trackIndex) {
  if (trackIndex <= 0) return SLIDE_COUNT - 1;
  if (trackIndex >= SLIDE_COUNT + 1) return 0;
  return trackIndex - 1;
}

function HeroSection({ searchQuery, onSearchChange }) {
  const navigate = useNavigate();
  const { deals } = useDeals();
  const brandNames = useMemo(
    () => deals.map((deal) => deal.brand).filter(Boolean),
    [deals],
  );
  const [trackIndex, setTrackIndex] = useState(1);
  const [withTransition, setWithTransition] = useState(true);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const trackIndexRef = useRef(1);
  const swipeRef = useRef({ x: 0, y: 0, tracking: false, swiped: false });

  const setTrack = useCallback((nextIndex) => {
    trackIndexRef.current = nextIndex;
    setTrackIndex(nextIndex);
  }, []);

  const goToSlide = useCallback(
    (displayIndex) => {
      const normalized = ((displayIndex % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
      setTrack(normalized + 1);
    },
    [setTrack],
  );

  const nextSlide = useCallback(() => {
    const current = trackIndexRef.current;
    if (current >= SLIDE_COUNT + 1) return;
    setTrack(current + 1);
  }, [setTrack]);

  const prevSlide = useCallback(() => {
    const current = trackIndexRef.current;
    if (current <= 0) return;
    setTrack(current - 1);
  }, [setTrack]);

  useEffect(() => {
    if (isPaused || dragging) {
      clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(nextSlide, SLIDE_INTERVAL);
    return () => {
      clearInterval(timerRef.current);
    };
  }, [isPaused, dragging, nextSlide]);

  const activeIndex = displayIndexFromTrack(trackIndex);

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.animation = "none";
      void progressRef.current.offsetHeight;
      progressRef.current.style.animation = "";
    }
  }, [activeIndex]);

  useLayoutEffect(() => {
    if (withTransition) return undefined;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setWithTransition(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [withTransition, trackIndex]);

  const handleTransitionEnd = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.propertyName !== "transform") return;
    const index = trackIndexRef.current;
    if (index === 0) {
      setWithTransition(false);
      setTrack(SLIDE_COUNT);
    } else if (index === SLIDE_COUNT + 1) {
      setWithTransition(false);
      setTrack(1);
    }
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    swipeRef.current = {
      x: event.clientX,
      y: event.clientY,
      tracking: true,
      swiped: false,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!swipeRef.current.tracking) return;
    const dx = event.clientX - swipeRef.current.x;
    const dy = event.clientY - swipeRef.current.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      swipeRef.current.swiped = true;
    }
    if (swipeRef.current.swiped) {
      setDragOffset(dx);
    }
  };

  const finishDrag = (clientX, clientY) => {
    if (!swipeRef.current.tracking) return;
    const dx = clientX - swipeRef.current.x;
    const dy = clientY - swipeRef.current.y;
    swipeRef.current.tracking = false;
    setDragging(false);
    setDragOffset(0);

    const horizontal = Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy);
    if (!horizontal) {
      swipeRef.current.swiped = false;
      return;
    }
    swipeRef.current.swiped = true;
    if (dx < 0) nextSlide();
    else prevSlide();
  };

  const handlePointerUp = (event) => {
    finishDrag(event.clientX, event.clientY);
  };

  const handlePointerCancel = () => {
    swipeRef.current.tracking = false;
    swipeRef.current.swiped = false;
    setDragging(false);
    setDragOffset(0);
  };

  const handleCarouselClickCapture = (event) => {
    if (!swipeRef.current.swiped) return;
    event.preventDefault();
    event.stopPropagation();
    swipeRef.current.swiped = false;
  };

  const handleSearchSubmit = () => {
    navigate(resolveBrandExplorePath(searchQuery, brandNames));
  };

  const animate = withTransition && !dragging;

  return (
    <section
      className="max-w-[1440px] mx-auto px-6 md:px-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="relative overflow-hidden rounded-2xl min-h-[220px] md:min-h-[200px] lg:min-h-[240px] mt-4 md:mt-6 touch-pan-y cursor-grab active:cursor-grabbing select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={handleCarouselClickCapture}
      >
        <div
          className="hero-slide-track flex h-full w-full"
          style={{
            transform: `translate3d(calc(${-trackIndex * 100}% + ${dragOffset}px), 0, 0)`,
            transition: animate ? `transform ${SLIDE_MS}ms ${SLIDE_EASE}` : "none",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {TRACK_SLIDES.map((slide, index) => (
            <div
              key={`${slide.id}-${index}`}
              className="hero-slide-panel flex h-full min-h-[220px] min-w-full w-full shrink-0 grow-0 basis-full flex-col justify-center px-6 py-6 md:min-h-[200px] md:px-12 lg:min-h-[240px]"
              style={{ background: slide.bgAccent }}
            >
              <SlideContent slide={slide} navigate={navigate} interactive={!dragging} />
            </div>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 px-6 md:px-12 pb-4 flex items-center gap-4">
          <div className="flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
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

          <div className="flex-1 h-0.5 bg-outline-variant/15 rounded-full overflow-hidden">
            <div
              ref={progressRef}
              className="h-full bg-primary/50 rounded-full hero-progress-bar"
              style={{
                animationDuration: `${SLIDE_INTERVAL}ms`,
                animationPlayState: isPaused || dragging ? "paused" : "running",
              }}
            />
          </div>

          <span className="text-xs font-headline font-bold text-on-surface-variant/40 tabular-nums tracking-wider">
            {String(activeIndex + 1).padStart(2, "0")} /{" "}
            {String(SLIDE_COUNT).padStart(2, "0")}
          </span>
        </div>
      </div>

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

function SlideContent({ slide, navigate, interactive = true }) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 w-full pb-6 md:pb-8 ${interactive ? "" : "pointer-events-none"}`}>
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
        type="button"
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
