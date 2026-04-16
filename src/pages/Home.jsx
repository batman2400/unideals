/**
 * Home Page
 *
 * The landing page at route "/".
 * Assembles the hero, categories, deal feed, and newsletter sections.
 *
 * Props:
 *   - searchQuery    : string — current search text (from App state)
 *   - onSearchChange : function — updates the search text
 */
import HeroSection from "../components/HeroSection";
import CategoryGrid from "../components/CategoryGrid";
import DealFeed from "../components/DealFeed";
import Newsletter from "../components/Newsletter";

function Home({ searchQuery, onSearchChange }) {
  return (
    <>
      <HeroSection searchQuery={searchQuery} onSearchChange={onSearchChange} />
      <CategoryGrid />
      <DealFeed searchQuery={searchQuery} />
      <Newsletter />
    </>
  );
}

export default Home;
