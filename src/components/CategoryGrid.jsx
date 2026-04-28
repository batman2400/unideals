/**
 * CategoryGrid Component
 *
 * A grid of category cards for the 10 official V1 categories.
 * Each card navigates to the Categories page with a URL-safe filter param.
 *
 * Uses Material Symbols for premium icons.
 */
import { useNavigate } from "react-router-dom";

// Official V1 taxonomy — icon (Material Symbols) + label
const categories = [
  { icon: "checkroom",       label: "Fashion" },
  { icon: "restaurant",      label: "Food & Drink" },
  { icon: "smartphone",      label: "Tech & Mobile" },
  { icon: "spa",             label: "Beauty & Care" },
  { icon: "school",          label: "Learning" },
  { icon: "flight",          label: "Travel & Auto" },
  { icon: "fitness_center",  label: "Health & Fitness" },
  { icon: "home",            label: "Household" },
  { icon: "account_balance", label: "Finance" },
  { icon: "confirmation_number", label: "Events & Tickets" },
];

function CategoryGrid() {
  const navigate = useNavigate();

  return (
    <section className="max-w-[1440px] mx-auto px-8 py-12">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-4">
        {categories.map((category) => (
          <button
            key={category.label}
            onClick={() => {
              const params = new URLSearchParams({
                filter: encodeURIComponent(category.label),
              });
              navigate(`/categories?${params.toString()}`);
            }}
            className="bg-surface-container-low p-6 flex flex-col items-center justify-center gap-4 rounded-xl group hover:bg-surface-container transition-colors cursor-pointer active:scale-[0.97]"
          >
            <span className="material-symbols-outlined text-3xl text-primary">
              {category.icon}
            </span>
            <span className="font-headline font-bold text-sm tracking-tight">
              {category.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default CategoryGrid;
