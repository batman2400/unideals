/**
 * HeroSection Component
 *
 * The big headline area at the top of the page with
 * the "Exclusive Student Deals" text and search bar.
 *
 * The arrow button navigates the user to /perks so they
 * can see search results in the full deal grid.
 *
 * Props:
 *   - searchQuery    : string — current search text
 *   - onSearchChange : function — updates search text
 */
import { useNavigate } from "react-router-dom";

function HeroSection({ searchQuery, onSearchChange }) {
  const navigate = useNavigate();

  // Navigate to /perks when the user clicks the search arrow
  const handleSearchSubmit = () => {
    navigate("/perks");
  };

  return (
    <section className="max-w-[1440px] mx-auto px-8 py-20 flex flex-col items-center text-center">
      <h1 className="font-headline font-extrabold text-7xl md:text-8xl tracking-tighter text-on-background mb-8 max-w-4xl">
        Exclusive Student <span className="text-primary italic">Deals.</span>
      </h1>

      <div className="w-full max-w-2xl relative">
        <label className="block text-xs font-bold tracking-[0.2em] text-on-surface-variant uppercase mb-3 text-left pl-1">
          Search for your favorite brands
        </label>
        <div className="flex items-center border-b border-outline-variant/30 pb-4">
          <input
            className="bg-transparent border-none w-full text-2xl font-headline placeholder:text-on-surface-variant/30 focus:ring-0 px-0"
            placeholder="e.g. Apple, Nike, Starbucks"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearchSubmit();
            }}
          />
          <button
            onClick={handleSearchSubmit}
            className="text-primary p-2 hover:scale-110 active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-4xl">arrow_forward</span>
          </button>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
