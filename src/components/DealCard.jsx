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
 *   - deal : object from mockData.js
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { checkIfSaved, saveDeal, unsaveDeal } from "../lib/useDeals";

function DealCard({ deal }) {
  const { id, title, type, discount, imageUrl, description } = deal;

  const isInStore = type === "In-Store";

  const [isSaved, setIsSaved] = useState(false);
  const [loadingSave, setLoadingSave] = useState(true);

  useEffect(() => {
    let active = true;
    checkIfSaved(id).then((saved) => {
      if (active) {
        setIsSaved(saved);
        setLoadingSave(false);
      }
    }).catch(() => {
      if (active) setLoadingSave(false);
    });
    return () => { active = false; };
  }, [id]);

  const handleToggleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Check login state: if not logged in, trigger custom event to open AuthModal
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.dispatchEvent(new Event("open-auth-modal"));
      return;
    }

    try {
      setLoadingSave(true);
      if (isSaved) {
        await unsaveDeal(id);
        setIsSaved(false);
      } else {
        await saveDeal(id);
        setIsSaved(true);
      }
    } catch (err) {
      console.error("Error toggling save:", err);
    } finally {
      setLoadingSave(false);
    }
  };

  return (
    <div className="flex flex-col group cursor-pointer relative transition-all duration-300 hover:-translate-y-1 hover:shadow-lg rounded-xl">
      {/* Deal Image */}
      <Link to={`/perks/${id}`} className="block relative">
        <div className="aspect-[16/10] overflow-hidden rounded-xl relative bg-surface-container">
          {/* Save Button */}
          <button
            onClick={handleToggleSave}
            disabled={loadingSave}
            className={`absolute top-4 left-4 z-10 w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-md transition-all shadow-sm ${
              loadingSave ? "opacity-50 cursor-not-allowed" : "hover:scale-110"
            } ${
              isSaved
                ? "bg-primary text-on-primary"
                : "bg-surface/80 text-on-surface hover:bg-surface"
            }`}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={isSaved ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              bookmark
            </span>
          </button>

          <img
            alt={title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            src={imageUrl}
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
          <h3 className="font-headline font-extrabold text-2xl tracking-tight">{title}</h3>
          <span className="text-primary font-headline font-black text-xl">{discount}</span>
        </div>
        <p className="text-on-surface-variant text-sm mb-4 leading-relaxed">{description}</p>
        <Link
          to={`/perks/${id}`}
          className="block w-full py-3 rounded-md border border-outline-variant/20 font-headline font-bold text-sm text-center group-hover:bg-primary group-hover:text-on-primary transition-all active:scale-[0.98]"
        >
          {isInStore ? "Show at Register" : "Claim Code"}
        </Link>
      </div>
    </div>
  );
}

export default DealCard;
