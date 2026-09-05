import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import HeroSection from "../components/HeroSection";
import ExploreFeed from "../components/ExploreFeed";
import HomeFAQ from "../components/HomeFAQ";
import SiteNavigationSchema from "../components/SiteNavigationSchema";
import { slugify, DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_WIDTH, DEFAULT_OG_IMAGE_HEIGHT } from "../lib/seo";
import { OFFICIAL_CATEGORIES } from "../lib/categories";

const CATEGORY_PILL_EMOJI = {
  "Food & Drink": "🍔",
  Fashion: "👗",
  "Tech & Mobile": "💻",
  Learning: "📚",
  "Beauty & Care": "💄",
  "Travel & Auto": "✈️",
  "Health & Fitness": "💪",
  Household: "🏠",
  Finance: "💳",
  "Events & Tickets": "🎫",
};

const categories = [
  { emoji: "✨", label: "All", filter: null },
  ...OFFICIAL_CATEGORIES.map((name) => ({
    emoji: CATEGORY_PILL_EMOJI[name] || "✨",
    label: name,
    filter: name,
  })),
];

function Home({ searchQuery, onSearchChange }) {
  const navigate = useNavigate();

  return (
    <div className="w-full animate-fade-in">
      <Helmet>
        <title>Uni Deals | The Best Student Discounts & Offers in Sri Lanka</title>
        <meta name="description" content="Unlock exclusive student discounts and the best student offers in Sri Lanka. Save on daily dining, tech accessories, and clothing using your verified university email." />
        <meta name="keywords" content="student discounts in sri lanka, student offers in sri lanka, university deals colombo, kdu student offers, sliit discounts" />
        <link rel="canonical" href="https://www.unideals.co/" />
        
        {/* Open Graph / Social Sharing */}
        <meta property="og:title" content="Uni Deals | Exclusive Student Discounts in Sri Lanka" />
        <meta property="og:description" content="Unlock exclusive student discounts and the best student offers in Sri Lanka. Save on daily dining, tech, and clothing." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.unideals.co/" />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta property="og:image:width" content={DEFAULT_OG_IMAGE_WIDTH} />
        <meta property="og:image:height" content={DEFAULT_OG_IMAGE_HEIGHT} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Uni Deals | Exclusive Student Discounts in Sri Lanka" />
        <meta name="twitter:description" content="Unlock exclusive student discounts and the best student offers in Sri Lanka. Save on daily dining, tech, and clothing." />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
      </Helmet>
      
      <SiteNavigationSchema />

      {/* SEO Optimized Headers */}
      <div className="sr-only">
        <h1>Exclusive Discounts & Perks for University Students in Sri Lanka</h1>
        <h2>Save on tech, dining, fashion, and entertainment using your verified university email.</h2>
      </div>

      <HeroSection searchQuery={searchQuery} onSearchChange={onSearchChange} />
      
      {/* Compact category pills */}
      <div className="sticky top-0 z-20 border-b border-outline-variant/10 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto px-4 py-3 md:px-8 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => {
                if (!cat.filter) {
                  navigate("/");
                  return;
                }
                navigate(`/category/${slugify(cat.filter)}`);
              }}
              className="flex-shrink-0 rounded-full bg-surface-container px-3.5 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:bg-primary hover:text-on-primary active:scale-[0.98]"
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>

      <ExploreFeed searchQuery={searchQuery} />

      <HomeFAQ />

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
