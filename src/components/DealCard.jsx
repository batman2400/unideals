/**
 * DealCard — lifestyle, image-first deal card.
 *
 * Variants:
 *   - hero  : 4:5 full-bleed portrait with gradient overlay (trending row)
 *   - grid  : 1:1 square image + brand / title / fulfillment pill below
 *
 * No "Claim Code" CTA — the whole card links to deal details.
 */
import { memo, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { checkIfSaved, saveDeal, unsaveDeal } from "../lib/useDeals";

/** Stable demo urgency until expiry lands in the API. */
function getDaysLeft(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return 5;
  return (Math.abs(n) % 14) + 1;
}

function DealCard({
  deal,
  isSaved: batchSaved,
  onToggleSave: batchToggle,
  savedLoading: batchLoading,
  variant = "grid",
}) {
  const { id, title, brand, type, discount, imageUrl } = deal;
  const isInStore = type === "In-Store";
  const isDemo = typeof id === "string" && id.startsWith("demo-");
  const isHero = variant === "hero";
  const daysLeft = getDaysLeft(id);
  const headline = discount || title;

  const isBatchMode = batchSaved !== undefined;
  const [localSaved, setLocalSaved] = useState(false);
  const [localLoading, setLocalLoading] = useState(!isBatchMode);

  useEffect(() => {
    if (isBatchMode || isDemo) {
      setLocalLoading(false);
      return;
    }
    let active = true;
    checkIfSaved(id)
      .then((saved) => {
        if (active) {
          setLocalSaved(saved);
          setLocalLoading(false);
        }
      })
      .catch(() => {
        if (active) setLocalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, isDemo, isBatchMode]);

  const saved = isBatchMode ? !!batchSaved : localSaved;
  const loading = isBatchMode ? !!batchLoading : localLoading;

  const handleToggleSave = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.dispatchEvent(new Event("open-auth-modal"));
        return;
      }

      try {
        if (isBatchMode && batchToggle) {
          await batchToggle(id);
        } else {
          setLocalLoading(true);
          if (localSaved) {
            await unsaveDeal(id);
            setLocalSaved(false);
          } else {
            await saveDeal(id);
            setLocalSaved(true);
          }
          setLocalLoading(false);
        }
      } catch (err) {
        console.error("Error toggling save:", err);
        if (!isBatchMode) setLocalLoading(false);
      }
    },
    [id, isBatchMode, batchToggle, localSaved],
  );

  if (isHero) {
    return (
      <Link
        to={isDemo ? "#" : `/perks/${id}`}
        onClick={isDemo ? (e) => e.preventDefault() : undefined}
        className="group relative block w-full aspect-[4/5] overflow-hidden rounded-2xl bg-surface-container"
      >
        <img
          alt={title}
          src={imageUrl}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {/* Top-left badges */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          <span className="inline-flex self-start rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
            {isInStore ? "🏪 In-Store" : "🌐 Online"}
          </span>
          <span className="inline-flex self-start rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white backdrop-blur-sm">
            ⌛ {daysLeft} {daysLeft === 1 ? "day" : "days"} left
          </span>
        </div>

        {/* Top-right heart */}
        {!isDemo && (
          <button
            type="button"
            onClick={handleToggleSave}
            disabled={loading}
            aria-label={saved ? "Remove from saved" : "Save deal"}
            className={`absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:scale-110 ${
              loading ? "opacity-50" : ""
            }`}
          >
            <span
              className="material-symbols-outlined text-lg"
              style={saved ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              favorite
            </span>
          </button>
        )}

        {/* Bottom gradient + copy */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[55%] bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-10 p-4">
          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white/85">
            {brand}
          </p>
          <h3 className="font-headline text-xl font-extrabold leading-tight tracking-tight text-white line-clamp-2 md:text-2xl">
            {headline}
          </h3>
        </div>
      </Link>
    );
  }

  // Grid / default — image-first, no claim button
  return (
    <Link
      to={isDemo ? "#" : `/perks/${id}`}
      onClick={isDemo ? (e) => e.preventDefault() : undefined}
      className="group flex flex-col"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface-container">
        <img
          alt={title}
          src={imageUrl}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {!isDemo && (
          <button
            type="button"
            onClick={handleToggleSave}
            disabled={loading}
            aria-label={saved ? "Remove from saved" : "Save deal"}
            className={`absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md shadow-sm transition hover:scale-110 ${
              loading ? "opacity-50" : ""
            } ${
              saved
                ? "bg-primary text-on-primary"
                : "bg-white/85 text-on-surface"
            }`}
          >
            <span
              className="material-symbols-outlined text-lg"
              style={saved ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              favorite
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1 pt-2.5">
        <p className="text-[11px] font-semibold text-on-surface-variant truncate">
          {brand}
        </p>
        <h3 className="font-headline text-sm font-bold leading-snug text-on-background line-clamp-2 md:text-[15px]">
          {headline}
        </h3>
        <span className="mt-0.5 inline-flex self-start rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
          {isInStore ? "🏪 In-store" : "🌐 Online"}
        </span>
      </div>
    </Link>
  );
}

export default memo(DealCard);
