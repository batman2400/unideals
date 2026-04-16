/**
 * CategoryGrid Component
 *
 * A row of category buttons (Coffee, Laptops, Clothing, etc.)
 * that users can click to navigate to the Categories page.
 *
 * TIP: The categories are stored in a simple array at the top.
 * To add/remove categories, just edit this array!
 */
import { useNavigate } from "react-router-dom";

// Each category has an icon name (from Material Symbols) and a label
const categories = [
  { icon: "coffee", label: "Coffee" },
  { icon: "laptop_mac", label: "Tech" },
  { icon: "apparel", label: "Clothing" },
  { icon: "fitness_center", label: "Fitness" },
  { icon: "home", label: "Home" },
  { icon: "palette", label: "Creative" },
];

function CategoryGrid() {
  const navigate = useNavigate();

  return (
    <section className="max-w-[1440px] mx-auto px-8 py-12">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {categories.map((category) => (
          <button
            key={category.label}
            onClick={() => {
              const params = new URLSearchParams({ filter: category.label });
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
