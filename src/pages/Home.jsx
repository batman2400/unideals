/**
 * Home Page
 *
 * The landing page at route "/".
 * Assembles the hero, categories, and deal feed sections.
 *
 * Props:
 *   - searchQuery    : string — current search text (from App state)
 *   - onSearchChange : function — updates the search text
 */
import HeroSection from "../components/HeroSection";
import CategoryGrid from "../components/CategoryGrid";
import DealFeed from "../components/DealFeed";

function Home({ searchQuery, onSearchChange }) {
  return (
    <>
      <HeroSection searchQuery={searchQuery} onSearchChange={onSearchChange} />
      <CategoryGrid />
      <DealFeed searchQuery={searchQuery} />
    </>
  );
}

export default Home;
