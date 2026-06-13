/**
 * DealCard Component
 *
 * A single deal card showing the deal image, brand name, discount,
 * description, and a "Claim Deal" link that navigates to the
 * DealDetails page via React Router.
 *
 * The badge clearly differentiates In-Store (with store icon + warm
 * amber accent) vs Online (with globe icon + emerald accent) at a glance.
 *
 * Props:
 *   - deal          : object — deal data
 *   - isSaved       : boolean|undefined — batch-provided saved state (from parent)
 *   - onToggleSave  : function(dealId)|undefined — batch toggle (from parent)
 *   - savedLoading  : boolean|undefined — batch loading state (from parent)
 *
 * When batch props are provided (via DealGrid ← useSavedDealIds),
 * the card uses them directly instead of querying the database individually.
 * This eliminates the N+1 query problem.
 */
import { memo, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { checkIfSaved, saveDeal, unsaveDeal } from "../lib/useDeals";

function DealCard({
  deal,
  isSaved: batchSaved,
  onToggleSave: batchToggle,
  savedLoading: batchLoading,
}) {
  const { id, title, type, discount, imageUrl, description } = deal;

  const isInStore = type === "In-Store";
  const isDemo = typeof id === "string" && id.startsWith("demo-");

  // ── Determine if we're using batch mode or standalone mode ──
  const isBatchMode = batchSaved !== undefined;

  // ── Standalone state (used only when batch props are NOT provided) ──
  const [localSaved, setLocalSaved] = useState(false);
  const [localLoading, setLocalLoading] = useState(!isBatchMode);
  const [saveError, setSaveError] = useState("");

  // Standalone: fetch saved state individually (only if no batch props)
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
        if (active) {
          setSaveError("Could not verify saved state right now.");
          setLocalLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, isDemo, isBatchMode]);

  // ── Resolve actual values ──
  const saved = isBatchMode ? !!batchSaved : localSaved;
  const loading = isBatchMode ? !!batchLoading : localLoading;

  const handleToggleSave = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSaveError("");

      // Check login state
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
        setSaveError(
          err?.message || "Could not update saved state. Please try again.",
        );
        if (!isBatchMode) setLocalLoading(false);
      }
    },
    [id, isBatchMode, batchToggle, localSaved],
  );

  return (
    <div className="flex flex-col group cursor-pointer relative transition-all duration-300 hover:-translate-y-1 hover:shadow-lg rounded-xl">
      {/* Deal Image */}
      <Link
        to={isDemo ? "#" : `/perks/${id}`}
        className="block relative"
        onClick={isDemo ? (e) => e.preventDefault() : undefined}
      >
        <div className="aspect-[16/10] overflow-hidden rounded-xl relative bg-surface-container">
          {/* Save Button */}
          {!isDemo && (
            <button
              onClick={handleToggleSave}
              disabled={loading}
              className={`absolute top-4 left-4 z-10 w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-md transition-all shadow-sm ${
                loading ? "opacity-50 cursor-not-allowed" : "hover:scale-110"
              } ${
                saved
                  ? "bg-primary text-on-primary"
                  : "bg-surface/80 text-on-surface hover:bg-surface"
              }`}
            >
              <span
                className="material-symbols-outlined text-xl"
                style={saved ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                bookmark
              </span>
            </button>
          )}

          <img
            alt={title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            src={imageUrl}
            loading="lazy"
            decoding="async"
          />
          {/* Type Badge — visually distinct per redemption method */}
          <div className="absolute top-4 right-4">
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm ${
                isInStore
                  ? "bg-amber-50/90 text-amber-800 border border-amber-200/60"
                  : "bg-primary-container/90 text-on-primary-container border border-primary/20"
              }`}
            >
              <span className="material-symbols-outlined text-xs">
                {isInStore ? "storefront" : "language"}
              </span>
              {isInStore ? "In-Store" : "Online"}
            </span>
          </div>
        </div>
      </Link>

      {/* Deal Info */}
      <div className="pt-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-headline font-extrabold text-2xl tracking-tight">
            {title}
          </h3>
          <span className="text-primary font-headline font-black text-xl">
            {discount}
          </span>
        </div>
        <p className="text-on-surface-variant text-sm mb-4 leading-relaxed">
          {description}
        </p>
        {saveError && (
          <p className="text-error text-xs font-bold mb-3">{saveError}</p>
        )}
        {isDemo ? (
          <span className="block w-full py-3 rounded-md border border-outline-variant/20 font-headline font-bold text-sm text-center text-on-surface-variant/50 cursor-default">
            Coming Soon
          </span>
        ) : (
          <Link
            to={`/perks/${id}`}
            className="block w-full py-3 rounded-md border border-outline-variant/20 font-headline font-bold text-sm text-center group-hover:bg-primary group-hover:text-on-primary transition-all active:scale-[0.98]"
          >
            {isInStore ? "Show at Register" : "Claim Code"}
          </Link>
        )}
      </div>
    </div>
  );
}

export default memo(DealCard);
