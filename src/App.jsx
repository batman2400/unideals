/**
 * App Component
 *
 * The root component that sets up:
 *   - Global state (auth modal, search query)
 *   - Persistent Navbar & Footer (visible on every page)
 *   - Route definitions for all pages
 *
 * Routes:
 *   /            → Home (hero, categories, deal feed, newsletter)
 *   /perks       → All Deals with type filters
 *   /categories  → Deals grouped by category
 *   /brands      → Partner directory
 */
import { useState } from "react";
import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";

import Home from "./pages/Home";
import Perks from "./pages/Perks";
import DealDetails from "./pages/DealDetails";
import Categories from "./pages/Categories";
import Brands from "./pages/Brands";

function App() {
  // ── Global UI State ──────────────────────────────────
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <>
      {/* Persistent Navbar */}
      <Navbar
        onOpenAuth={() => setAuthModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Page Content */}
      <main className="pt-24 pb-20">
        <Routes>
          <Route
            path="/"
            element={
              <Home
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            }
          />
          <Route
            path="/perks"
            element={<Perks searchQuery={searchQuery} />}
          />
          <Route path="/perks/:id" element={<DealDetails />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/brands" element={<Brands />} />
        </Routes>
      </main>

      {/* Persistent Footer */}
      <Footer />

      {/* Auth Modal (rendered globally, toggled by Navbar buttons) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  );
}

export default App;
