import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import HeroSection from "../components/HeroSection";
import DealFeed from "../components/DealFeed";
import FAQSchema from "../components/FAQSchema";
import SiteNavigationSchema from "../components/SiteNavigationSchema";

const categories = [
  { emoji: "✨", label: "All", filter: null },
  { emoji: "🍔", label: "Food & Drink", filter: "Food & Drink" },
  { emoji: "👗", label: "Fashion", filter: "Fashion" },
  { emoji: "💻", label: "Tech & Mobile", filter: "Tech & Mobile" },
  { emoji: "📚", label: "Learning", filter: "Learning" },
  { emoji: "💄", label: "Beauty & Care", filter: "Beauty & Care" },
  { emoji: "✈️", label: "Travel & Auto", filter: "Travel & Auto" },
  { emoji: "💪", label: "Health & Fitness", filter: "Health & Fitness" },
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
        <meta property="og:image" content="https://www.unideals.co/icon-512-v5.png" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48-v5.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96-v5.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-v5.png" />
      </Helmet>
      
      <FAQSchema />
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
                const params = new URLSearchParams({ filter: cat.filter });
                navigate(`/categories?${params.toString()}`);
              }}
              className="flex-shrink-0 rounded-full bg-surface-container px-3.5 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:bg-primary hover:text-on-primary active:scale-[0.98]"
            >
              {cat.emoji} {cat.label}
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
