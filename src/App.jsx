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
 *   /            → Home (hero, categories, deal feed)
 *   /perks       → All Deals with type filters
 *   /perks/:id   → Single deal details with redemption
 *   /categories  → Deals grouped by category
 *   /brands      → Partner directory
 *   /profile     → User dashboard & settings
 */
import { lazy, Suspense, useState, useEffect } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";
import ProtectedRoute from "./components/ProtectedRoute";

const Home = lazy(() => import("./pages/Home"));
const Perks = lazy(() => import("./pages/Perks"));
const DealDetails = lazy(() => import("./pages/DealDetails"));
const Categories = lazy(() => import("./pages/Categories"));
const Brands = lazy(() => import("./pages/Brands"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Profile = lazy(() => import("./pages/Profile"));
const SavedDeals = lazy(() => import("./pages/SavedDeals"));
const UniversityEvents = lazy(() => import("./pages/UniversityEvents"));
const Support = lazy(() => import("./pages/Support"));
const PartnerOverview = lazy(() => import("./pages/partner/PartnerOverview"));
const PartnerDeals = lazy(() => import("./pages/partner/PartnerDeals"));
const PartnerScanner = lazy(() => import("./pages/partner/PartnerScanner"));
const PartnerAnalytics = lazy(() => import("./pages/partner/PartnerAnalytics"));
const CreateDeal = lazy(() => import("./pages/partner/CreateDeal"));
const EditDeal = lazy(() => import("./pages/partner/EditDeal"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminPendingDeals = lazy(() => import("./pages/admin/AdminPendingDeals"));
const AdminAllDeals = lazy(() => import("./pages/admin/AdminAllDeals"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminBrands = lazy(() => import("./pages/admin/AdminBrands"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminVerifications = lazy(() => import("./pages/admin/AdminVerifications"));
const SupportTickets = lazy(() => import("./pages/admin/SupportTickets"));

function RouteSkeleton() {
  return (
    <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16 animate-fade-in">
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-surface-container-low rounded-lg" />
        <div className="h-16 w-3/4 bg-surface-container-low rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="h-56 bg-surface-container-low rounded-2xl" />
          <div className="h-56 bg-surface-container-low rounded-2xl" />
          <div className="h-56 bg-surface-container-low rounded-2xl" />
        </div>
      </div>
    </section>
  );
}

function App() {
  const location = useLocation();
  // ── Global UI State ──────────────────────────────────
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Supabase Auth State ──────────────────────────────
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // 1. Check for an existing session on initial load
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!active) return;
        if (error) {
          console.error("[App] Failed to load session:", error.message);
        }
        setSession(session ?? null);
        setAuthLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("[App] Unexpected session bootstrap error:", err);
        setSession(null);
        setAuthLoading(false);
      });

    // 2. Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSession(session);
      setAuthLoading(false);
    });

    // Cleanup listener on unmount
    return () => {
      active = false;
      subscription.unsubscribe();
    };
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant text-sm font-headline font-bold">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <Navbar onLogout={handleLogout} />
      <Sidebar onLogout={handleLogout} />

      {/* Page Content */}
      <main className="flex-1 pt-16 md:pt-0 pb-safe-content min-w-0 flex flex-col min-h-[100dvh]">
        <Suspense fallback={<RouteSkeleton />}>
          <div
            key={`${location.pathname}${location.search}`}
            className="animate-route-fade flex flex-col flex-1"
          >
            <Routes location={location}>
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
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/saved" element={<SavedDeals />} />
              <Route path="/events" element={<UniversityEvents />} />
              <Route path="/support" element={<Support />} />
              <Route
                path="/profile"
                element={<Profile isLoggedIn={isLoggedIn} user={user} />}
              />

              <Route
                path="/partner"
                element={
                  <ProtectedRoute allowedRoles={["partner", "admin"]}>
                    <Outlet />
                  </ProtectedRoute>
                }
              >
                <Route index element={<PartnerOverview />} />
                <Route path="deals" element={<PartnerDeals />} />
                <Route path="create-deal" element={<CreateDeal />} />
                <Route path="edit-deal/:id" element={<EditDeal />} />
                <Route path="scanner" element={<PartnerScanner />} />
                <Route path="analytics" element={<PartnerAnalytics />} />
              </Route>

              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Outlet />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminOverview />} />
                <Route path="pending" element={<AdminPendingDeals />} />
                <Route path="deals" element={<AdminAllDeals />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="/admin/verifications" element={<AdminVerifications />} />
                <Route path="/admin/brands" element={<AdminBrands />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/tickets" element={<SupportTickets />} />
              </Route>

              {/* Catch-all 404 → redirect to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Suspense>

        {/* Persistent Footer */}
        <Footer />
      </main>

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export default App;
