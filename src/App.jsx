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
 *   /deals       → All Deals with type filters
 *   /deals/:id   → Single deal details with redemption
 *   /categories  → Deals grouped by category
 *   /brands      → Partner directory
 *   /profile     → User dashboard & settings
 *   /auth/callback → Google OAuth PKCE return
 */
import { lazy, Suspense, useState, useEffect } from "react";
import { Routes, Route, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";
import ProtectedRoute from "./components/ProtectedRoute";
import Telemetry from "./components/Telemetry";

const loadHome = () => import("./pages/Home");
const Home = lazy(loadHome);
loadHome();
const Deals = lazy(() => import("./pages/Deals"));
const DealDetails = lazy(() => import("./pages/DealDetails"));
const Categories = lazy(() => import("./pages/Categories"));
const Brands = lazy(() => import("./pages/Brands"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Profile = lazy(() => import("./pages/Profile"));
const SavedDeals = lazy(() => import("./pages/SavedDeals"));
const UniversityEvents = lazy(() => import("./pages/UniversityEvents"));
const EventDetails = lazy(() => import("./pages/EventDetails"));
const CreateEvent = lazy(() => import("./pages/CreateEvent"));
const Support = lazy(() => import("./pages/Support"));
const PartnerOverview = lazy(() => import("./pages/partner/PartnerOverview"));
const PartnerDeals = lazy(() => import("./pages/partner/PartnerDeals"));
const PartnerEvents = lazy(() => import("./pages/partner/PartnerEvents"));
const PartnerScanner = lazy(() => import("./pages/partner/PartnerScanner"));
const PartnerAnalytics = lazy(() => import("./pages/partner/PartnerAnalytics"));
const CreateDeal = lazy(() => import("./pages/partner/CreateDeal"));
const EditDeal = lazy(() => import("./pages/partner/EditDeal"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminAllDeals = lazy(() => import("./pages/admin/AdminAllDeals"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminBrands = lazy(() => import("./pages/admin/AdminBrands"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminVerifications = lazy(() => import("./pages/admin/AdminVerifications"));
const SupportTickets = lazy(() => import("./pages/admin/SupportTickets"));
const AdminAllEvents = lazy(() => import("./pages/admin/AdminAllEvents"));
const AdminPendingEvents = lazy(() => import("./pages/admin/AdminPendingEvents"));
const Contact = lazy(() => import("./pages/Contact"));
const AdminInquiries = lazy(() => import("./pages/admin/AdminInquiries"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const AdminBlog = lazy(() => import("./pages/admin/AdminBlog"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const BrandPage = lazy(() => import("./pages/BrandPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** Legacy /perks/:id → /deals/:id, preserving the deal id. */
function LegacyDealRedirect() {
  const { id } = useParams();
  return <Navigate to={`/deals/${id}`} replace />;
}

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
  const [authModalError, setAuthModalError] = useState("");
  const [authModalTab, setAuthModalTab] = useState(null);
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

    const sessionTimeout = setTimeout(() => {
      if (!active) return;
      setAuthLoading((stillLoading) => {
        if (stillLoading) {
          console.error("[App] Session bootstrap timed out; continuing signed out.");
        }
        return false;
      });
    }, 8000);

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
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // ── Global Event Listener for Auth Modal ─────────────
  useEffect(() => {
    const handleOpenAuth = (event) => {
      setAuthModalError("");
      const tab = event?.detail?.tab;
      setAuthModalTab(
        tab === "signup" || tab === "login" ? tab : null,
      );
      setAuthModalOpen(true);
    };
    window.addEventListener("open-auth-modal", handleOpenAuth);
    return () => window.removeEventListener("open-auth-modal", handleOpenAuth);
  }, []);

  // /signup and /login land here via ?auth= so the modal opens on the
  // right tab without a dedicated auth page.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const auth = params.get("auth");
    if (auth !== "login" && auth !== "signup") return;

    setAuthModalError("");
    setAuthModalTab(auth);
    setAuthModalOpen(true);

    params.delete("auth");
    const cleaned = params.toString();
    const nextUrl = `${location.pathname}${cleaned ? `?${cleaned}` : ""}${location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }, [location.pathname, location.search, location.hash]);

  // Surface OAuth errors returned in the URL (e.g. user cancelled Google),
  // then strip the query params so a refresh doesn't reopen the modal.
  useEffect(() => {
    if (location.pathname === "/auth/callback") return;

    const params = new URLSearchParams(location.search);
    const error = params.get("error");
    const description = params.get("error_description");

    if (!error) return;

    const friendly =
      description?.replace(/\+/g, " ") ||
      "Google sign-in was cancelled or failed. Please try again.";

    setAuthModalError(friendly);
    setAuthModalOpen(true);
    console.error("[App] OAuth error:", error, description);

    params.delete("error");
    params.delete("error_description");
    params.delete("error_code");
    const cleaned = params.toString();
    const nextUrl = `${location.pathname}${cleaned ? `?${cleaned}` : ""}${location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }, [location.pathname, location.search, location.hash]);

  // Reset window scroll on navigation (e.g. Home "View all" → /deals)
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

  // Derived auth state
  const isLoggedIn = !!session;
  const user = session?.user ?? null;
  const isDealDetailsPage = /^\/deals\/[^/]+$/.test(location.pathname);
  const isAuthCallback = location.pathname === "/auth/callback";

  // ── Logout Handler ───────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Session will be set to null by the onAuthStateChange listener
  };

  // OAuth returns here with a PKCE code — keep chrome (nav/footer/modal)
  // off the screen so the exchange isn't interrupted by a route remount.
  if (isAuthCallback) {
    return (
      <Suspense
        fallback={
          <div className="min-h-[100dvh] flex items-center justify-center bg-background">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <AuthCallback />
      </Suspense>
    );
  }

  const authReady = !authLoading;

  return (
    <div className="flex flex-col min-h-screen w-full bg-background">
      <Telemetry />
      <div className="flex flex-1 w-full flex-col">
        <Navbar
          onLogout={handleLogout}
          isLoggedIn={isLoggedIn}
          authReady={authReady}
        />
        <Sidebar
          onLogout={handleLogout}
          isLoggedIn={isLoggedIn}
          authReady={authReady}
        />

        {/* Page Content */}
        <main
          className={`flex-1 pt-16 md:pt-0 min-w-0 flex flex-col ${
            isDealDetailsPage ? "pb-16 md:pb-0" : "pb-16"
          }`}
        >
        <Suspense fallback={<RouteSkeleton />}>
          <div className="animate-route-fade flex flex-col flex-1">
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
                path="/deals"
                element={<Deals searchQuery={searchQuery} />}
              />
              <Route path="/deals/:id" element={<DealDetails />} />
              {/* Legacy /perks URLs — permanent client-side fallback in case
                  any old links/bookmarks slip past the vercel.json redirect. */}
              <Route path="/perks" element={<Navigate to="/deals" replace />} />
              <Route
                path="/perks/:id"
                element={<LegacyDealRedirect />}
              />
              <Route path="/categories" element={<Categories />} />
              <Route path="/category/:categoryId" element={<CategoryPage />} />
              <Route path="/brands" element={<Brands />} />
              <Route path="/brand/:brandId" element={<BrandPage />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route
                path="/saved"
                element={
                  <ProtectedRoute>
                    <SavedDeals />
                  </ProtectedRoute>
                }
              />
              <Route path="/events" element={<UniversityEvents />} />
              <Route path="/events/:id" element={<EventDetails />} />
              <Route
                path="/events/new"
                element={
                  <ProtectedRoute>
                    <CreateEvent />
                  </ProtectedRoute>
                }
              />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/support" element={<Support />} />
              <Route path="/contact" element={<Contact />} />
              {/* Public: the recovery link must open for signed-out users. */}
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route
                path="/signup"
                element={<Navigate to="/?auth=signup" replace />}
              />
              <Route
                path="/login"
                element={<Navigate to="/?auth=login" replace />}
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile isLoggedIn={isLoggedIn} user={user} />
                  </ProtectedRoute>
                }
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
                <Route
                  path="finished-deals"
                  element={<PartnerDeals finishedOnly />}
                />
                <Route path="events" element={<PartnerEvents />} />
                <Route
                  path="finished-events"
                  element={<PartnerEvents finishedOnly />}
                />
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
                <Route path="deals" element={<AdminAllDeals />} />
                <Route
                  path="finished-deals"
                  element={<AdminAllDeals finishedOnly />}
                />
                <Route path="events" element={<AdminAllEvents />} />
                <Route
                  path="finished-events"
                  element={<AdminAllEvents finishedOnly />}
                />
                <Route path="pending-events" element={<AdminPendingEvents />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="/admin/verifications" element={<AdminVerifications />} />
                <Route path="/admin/brands" element={<AdminBrands />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/tickets" element={<SupportTickets />} />
                <Route path="inquiries" element={<AdminInquiries />} />
                <Route path="blog" element={<AdminBlog />} />
              </Route>

              {/* Catch-all 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </Suspense>

        </main>
      </div>

      {/* Persistent Footer — hidden on deal details so the split layout can fit the viewport */}
      {!isDealDetailsPage && <Footer />}

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialError={authModalError}
        initialTab={authModalTab}
        onClose={() => {
          setAuthModalOpen(false);
          setAuthModalError("");
          setAuthModalTab(null);
        }}
      />
    </div>
  );
}

export default App;
