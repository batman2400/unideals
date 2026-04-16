/**
 * App Component
 *
 * The root component that sets up:
 *   - Supabase auth session listener (real authentication)
 *   - Global state (auth modal, search query)
 *   - Persistent Navbar & Footer (visible on every page)
 *   - Route definitions for all pages
 *
 * Routes:
 *   /            → Home (hero, categories, deal feed, newsletter)
 *   /perks       → All Deals with type filters
 *   /perks/:id   → Single deal details with redemption
 *   /categories  → Deals grouped by category
 *   /brands      → Partner directory
 *   /profile     → User dashboard & settings
 */
import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";

import Home from "./pages/Home";
import Perks from "./pages/Perks";
import DealDetails from "./pages/DealDetails";
import Categories from "./pages/Categories";
import Brands from "./pages/Brands";
import Profile from "./pages/Profile";

function App() {
  // ── Global UI State ──────────────────────────────────
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Supabase Auth State ──────────────────────────────
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // 1. Check for an existing session on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // 2. Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Cleanup listener on unmount
    return () => subscription.unsubscribe();
  }, []);

  // ── Global Event Listener for Auth Modal ─────────────
  useEffect(() => {
    const handleOpenAuth = () => setAuthModalOpen(true);
    window.addEventListener("open-auth-modal", handleOpenAuth);
    return () => window.removeEventListener("open-auth-modal", handleOpenAuth);
  }, []);

  // Derived auth state
  const isLoggedIn = !!session;
  const user = session?.user ?? null;

  // ── Logout Handler ───────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Session will be set to null by the onAuthStateChange listener
  };

  // Don't render until initial session check is done
  // This prevents a flash of unauthenticated UI
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant text-sm font-headline font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Persistent Navbar */}
      <Navbar
        onOpenAuth={() => setAuthModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isLoggedIn={isLoggedIn}
        user={user}
        onLogout={handleLogout}
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
          <Route
            path="/profile"
            element={<Profile isLoggedIn={isLoggedIn} user={user} />}
          />
        </Routes>
      </main>

      {/* Persistent Footer */}
      <Footer />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  );
}

export default App;
