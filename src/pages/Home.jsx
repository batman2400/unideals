import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import HeroSection from "../components/HeroSection";
import DealFeed from "../components/DealFeed";
import FAQSchema from "../components/FAQSchema";
import SiteNavigationSchema from "../components/SiteNavigationSchema";

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
      <Helmet>
        <title>Uni Deals | The Best Student Discounts & Offers in Sri Lanka</title>
        <meta name="description" content="Unlock exclusive student discounts and the best student offers in Sri Lanka. Save on daily dining, tech accessories, and clothing using your verified university email." />
        <meta name="keywords" content="student discounts in sri lanka, student offers in sri lanka, university deals colombo, kdu student offers, sliit discounts" />
        <link rel="canonical" href="https://unideals.co/" />
        
        {/* Open Graph / Social Sharing */}
        <meta property="og:title" content="Uni Deals | Exclusive Student Discounts in Sri Lanka" />
        <meta property="og:description" content="Unlock exclusive student discounts and the best student offers in Sri Lanka. Save on daily dining, tech, and clothing." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://unideals.co/" />
      </Helmet>
      
      <FAQSchema />
      <SiteNavigationSchema />

      {/* SEO Optimized Headers */}
      <div className="sr-only">
        <h1>Exclusive Discounts & Perks for University Students in Sri Lanka</h1>
        <h2>Save on tech, dining, fashion, and entertainment using your verified university email.</h2>
      </div>

      <HeroSection searchQuery={searchQuery} onSearchChange={onSearchChange} />
      
      {/* Category Chips - Touch Swipeable Row */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-4 mb-2">
        <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] -mx-4 px-4 md:mx-0 md:px-0">
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => {
                const params = new URLSearchParams({ filter: cat.label });
                navigate(`/categories?${params.toString()}`);
              }}
              className="flex-shrink-0 flex items-center gap-2.5 bg-surface-container-low border border-outline-variant/15 px-5 py-3 rounded-2xl hover:bg-surface-container hover:border-outline-variant/30 hover:shadow-sm transition-all active:scale-[0.98] min-h-[48px]"
            >
              <span className="material-symbols-outlined text-primary text-2xl drop-shadow-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                {cat.icon}
              </span>
              <span className="font-headline font-bold text-sm md:text-base text-on-surface whitespace-nowrap tracking-tight">
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <DealFeed searchQuery={searchQuery} />

      {/* SEO Supported Campuses Section */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12 border-t border-outline-variant/20 mt-8">
        <h3 className="text-lg font-headline font-bold text-on-surface mb-3">Supported Campuses</h3>
        <p className="text-sm text-on-surface-variant max-w-3xl leading-relaxed">
          Available for students at SLIIT, NSBM, University of Colombo, University of Moratuwa, KDU, CINEC, and more.
        </p>
      </section>
    </div>
  );
}

export default Home;
