import { useNavigate } from "react-router-dom";
import HeroSection from "../components/HeroSection";
import DealFeed from "../components/DealFeed";

const categories = [
  { icon: "checkroom", label: "Fashion" },
  { icon: "restaurant", label: "Food & Drink" },
  { icon: "smartphone", label: "Tech & Mobile" },
  { icon: "spa", label: "Beauty & Care" },
  { icon: "school", label: "Learning" },
  { icon: "flight", label: "Travel & Auto" },
  { icon: "fitness_center", label: "Health & Fitness" },
  { icon: "home", label: "Household" },
  { icon: "account_balance", label: "Finance" },
  { icon: "confirmation_number", label: "Events & Tickets" },
];

function Home({ searchQuery, onSearchChange }) {
  const navigate = useNavigate();

  return (
    <div className="w-full animate-fade-in">
      <HeroSection searchQuery={searchQuery} onSearchChange={onSearchChange} />
      
      {/* Category Chips - Touch Swipeable Row */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-4 mb-2">
        <div className="flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => {
                const params = new URLSearchParams({ filter: cat.label });
                navigate(`/categories?${params.toString()}`);
              }}
              className="flex-shrink-0 flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 px-5 py-2.5 rounded-full hover:bg-surface-container hover:border-outline-variant/40 transition-colors snap-start active:scale-[0.98] min-h-[44px]"
            >
              <span className="material-symbols-outlined text-primary text-[18px]">
                {cat.icon}
              </span>
              <span className="font-headline font-bold text-sm text-on-surface-variant whitespace-nowrap">
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <DealFeed searchQuery={searchQuery} />
    </div>
  );
}

export default Home;
