/**
 * DealCard — lifestyle, image-first deal card.
 *
 * Variants:
 *   - hero  : 4:5 full-bleed portrait with gradient overlay (trending row)
 *   - grid  : 1:1 square image + brand / title / fulfillment pill below
 *
 * Coming Soon uses a locked overlay (not a heavy blue banner) so live cards
 * stay visually distinct.
 */
import { memo, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { checkIfSaved, saveDeal, unsaveDeal } from "../lib/useDeals";
import { formatLaunchRelative, isComingSoonDeal, isExpiredDeal } from "../lib/comingSoon";

/** Days remaining until endTime, or null when unavailable. */
function getDaysLeft(endTime) {
  if (!endTime) return null;
  const end = new Date(endTime);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function EndedLock({ compact = false }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center px-3 text-center">
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative flex flex-col items-center gap-1.5">
        <span
          className={`material-symbols-outlined text-white drop-shadow-md ${
            compact ? "text-3xl" : "text-4xl"
          }`}
        >
          event_busy
        </span>
        <p
          className={`font-headline font-extrabold tracking-tight text-white drop-shadow-md ${
            compact ? "text-sm" : "text-base md:text-lg"
          }`}
        >
          Ended
        </p>
      </div>
    </div>
  );
}

function ComingSoonLock({ relativeLabel, compact = false }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center px-3 text-center">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative flex flex-col items-center gap-1.5">
        <span
          className={`material-symbols-outlined text-white drop-shadow-md ${
            compact ? "text-3xl" : "text-4xl"
          }`}
        >
          lock_clock
        </span>
        <p
          className={`font-headline font-extrabold tracking-tight text-white drop-shadow-md ${
            compact ? "text-sm" : "text-base md:text-lg"
          }`}
        >
          Coming Soon
        </p>
        {relativeLabel ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/95 backdrop-blur-md">
            <span className="material-symbols-outlined text-[12px]">
              schedule
            </span>
            {relativeLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  isSaved: batchSaved,
  onToggleSave: batchToggle,
  savedLoading: batchLoading,
  variant = "grid",
}) {
  const {
    id,
    title,
    brand,
    type,
    discount,
    imageUrl,
    endTime,
    showEndDate,
    startTime,
  } = deal;
  const isInStore = type === "In-Store";
  const isDemo = typeof id === "string" && id.startsWith("demo-");
  const isHero = variant === "hero";
  const comingSoon = isComingSoonDeal(deal);
  const expired = !comingSoon && isExpiredDeal(deal);
  const relativeLaunch = comingSoon ? formatLaunchRelative(startTime) : "";
  const daysLeft =
    !comingSoon && !expired && showEndDate ? getDaysLeft(endTime) : null;
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

  const imageLoading = isDemo ? "eager" : "lazy";
  const hasImage = Boolean(imageUrl);

  const imageOrPlaceholder = hasImage ? (
    <img
      alt={title}
      src={imageUrl}
      loading={imageLoading}
      decoding="async"
      className={
        isHero
          ? "absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          : "h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      }
      width={isHero ? 800 : 640}
      height={isHero ? 1000 : 640}
    />
  ) : (
    <div
      className={
        isHero
          ? "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-container px-4 text-center"
          : "flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-container px-4 text-center"
      }
      aria-hidden={!isDemo}
    >
      <span className="material-symbols-outlined text-3xl text-on-surface-variant/60">
        image
      </span>
      {isDemo && (
        <p className="text-xs font-semibold text-on-surface-variant">
          Upload an image to preview
        </p>
      )}
    </div>
  );

  if (isHero) {
    return (
      <Link
        to={isDemo ? "#" : `/deals/${id}`}
        onClick={isDemo ? (e) => e.preventDefault() : undefined}
        className="group relative block w-full aspect-[4/5] overflow-hidden rounded-2xl bg-surface-container"
      >
        {imageOrPlaceholder}

        {comingSoon && (
          <ComingSoonLock relativeLabel={relativeLaunch} />
        )}
        {expired && <EndedLock />}

        {/* Top-left: type only — avoid stacking with coming-soon banners */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          <span className="inline-flex self-start rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
            {isInStore ? "🏪 In-Store" : "🌐 Online"}
          </span>
          {daysLeft !== null && (
            <span className="inline-flex self-start rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white backdrop-blur-sm">
              ⌛ {daysLeft === 0
                ? "Ends today"
                : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
            </span>
          )}
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
      to={isDemo ? "#" : `/deals/${id}`}
      onClick={isDemo ? (e) => e.preventDefault() : undefined}
      className="group flex flex-col"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface-container">
        {imageOrPlaceholder}
        {comingSoon && (
          <ComingSoonLock relativeLabel={relativeLaunch} compact />
        )}
        {expired && <EndedLock compact />}
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
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          <span className="inline-flex self-start rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
            {isInStore ? "🏪 In-store" : "🌐 Online"}
          </span>
          {comingSoon && relativeLaunch && (
            <span className="inline-flex self-start items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
              <span className="material-symbols-outlined text-[12px]">
                schedule
              </span>
              {relativeLaunch}
            </span>
          )}
          {expired && (
            <span className="inline-flex self-start rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
              Ended
            </span>
          )}
          {daysLeft !== null && (
            <span className="inline-flex self-start rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
              ⌛ {daysLeft === 0
                ? "Ends today"
                : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default memo(DealCard);
