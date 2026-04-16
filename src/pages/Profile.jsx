/**
 * Profile Page (/profile)
 *
 * User dashboard with:
 *   - Header section (name, university, avatar)
 *   - Student verification badge
 *   - Tabbed content: Saved Deals, Active Subscriptions, Account Settings
 *
 * Props:
 *   - isLoggedIn : boolean — redirects to home if false
 *   - user       : object|null — Supabase user object
 */
import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useDeals } from "../lib/useDeals";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";

// Simulated saved deal IDs (bookmarked by user)
const savedDealIds = [1, 3, 6, 9, 11];

// Simulated active in-store subscriptions
const activeSubscriptions = [
  {
    id: 1,
    brand: "Brew & Co.",
    plan: "Student Monthly Pass",
    status: "Active",
    renewsOn: "May 15, 2026",
    discount: "15% OFF",
  },
  {
    id: 2,
    brand: "Nexus Fitness",
    plan: "All-Access Free Month",
    status: "Active",
    renewsOn: "May 01, 2026",
    discount: "FREE MONTH",
  },
  {
    id: 3,
    brand: "ThreadLine",
    plan: "Campus Essentials Club",
    status: "Paused",
    renewsOn: "—",
    discount: "35% OFF",
  },
];

const tabConfig = [
  { key: "saved", label: "Saved Deals", icon: "bookmark" },
  { key: "subscriptions", label: "Subscriptions", icon: "loyalty" },
  { key: "settings", label: "Settings", icon: "settings" },
];

function Profile({ isLoggedIn, user }) {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "saved";
  const [activeTab, setActiveTab] = useState(initialTab);

  // ── Fetch deals from Supabase ────────────────────────
  const { deals, loading: dealsLoading, error: dealsError } = useDeals();
  const savedDeals = deals.filter((d) => savedDealIds.includes(d.id));

  // ── Derive user info from Supabase user object ───────
  const userEmail = user?.email ?? "user@example.com";
  const fullName =
    user?.user_metadata?.full_name ||
    userEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const initials = fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // ── Settings form state ──────────────────────────────
  const [settingsEmail, setSettingsEmail] = useState(userEmail);
  const [settingsPassword, setSettingsPassword] = useState("");
  const [notifyDeals, setNotifyDeals] = useState(true);
  const [notifyNewsletter, setNotifyNewsletter] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const handleSettingsSave = (e) => {
    e.preventDefault();
    console.log("[Settings] Saved:", { settingsEmail, notifyDeals, notifyNewsletter });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  // Guard — redirect if not logged in
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16">
      {/* ── Profile Header ────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8 mb-12">
        {/* Avatar */}
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl emerald-gradient flex items-center justify-center shadow-lg flex-shrink-0">
          <span className="text-on-primary font-headline font-black text-3xl md:text-4xl">{initials}</span>
        </div>

        {/* Info */}
        <div className="flex-1">
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background mb-1">
            {fullName}
          </h1>
          <p className="text-on-surface-variant text-base md:text-lg mb-3">
            {userEmail}
          </p>

          {/* Verification Badge */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 bg-primary-container/40 text-primary border border-primary/15 text-xs font-bold px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-sm">verified</span>
              Student Status: Verified
            </span>
            <button className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant/60 hover:text-primary border border-outline-variant/20 px-3 py-1.5 rounded-full transition-colors">
              <span className="material-symbols-outlined text-sm">id_card</span>
              Re-verify ID
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-6 md:gap-8 flex-shrink-0">
          <div className="text-center">
            <p className="font-headline font-black text-2xl text-on-background">{savedDeals.length}</p>
            <p className="text-xs text-on-surface-variant/60 font-bold uppercase tracking-wider">Saved</p>
          </div>
          <div className="text-center">
            <p className="font-headline font-black text-2xl text-on-background">
              {activeSubscriptions.filter((s) => s.status === "Active").length}
            </p>
            <p className="text-xs text-on-surface-variant/60 font-bold uppercase tracking-wider">Active</p>
          </div>
          <div className="text-center">
            <p className="font-headline font-black text-2xl text-primary">12</p>
            <p className="text-xs text-on-surface-variant/60 font-bold uppercase tracking-wider">Claimed</p>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ────────────────────────────────────────── */}
      <div className="flex gap-1 bg-surface-container-low rounded-xl p-1 mb-10 overflow-x-auto">
        {tabConfig.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 text-sm font-headline font-bold tracking-tight rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-primary text-on-primary shadow-md"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ────────────────────────────────────── */}

      {/* Saved Deals */}
      {activeTab === "saved" && (
        <div className="animate-modal-enter">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-headline font-extrabold text-2xl tracking-tighter text-on-background">
                Saved Deals
              </h2>
              <p className="text-on-surface-variant text-sm mt-1">
                Your bookmarked offers — ready when you are.
              </p>
            </div>
            <Link
              to="/perks"
              className="hidden sm:inline-flex items-center gap-1 text-sm text-primary font-headline font-bold hover:underline"
            >
              Browse more
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
          {(dealsLoading || dealsError) ? (
            <DealsLoader loading={dealsLoading} error={dealsError} />
          ) : (
            <DealGrid deals={savedDeals} />
          )}
        </div>
      )}

      {/* Active Subscriptions */}
      {activeTab === "subscriptions" && (
        <div className="animate-modal-enter">
          <div className="mb-6">
            <h2 className="font-headline font-extrabold text-2xl tracking-tighter text-on-background">
              Active Subscriptions
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">
              Your ongoing in-store memberships and plans.
            </p>
          </div>

          <div className="space-y-4">
            {activeSubscriptions.map((sub) => (
              <div
                key={sub.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-container-low rounded-xl p-5 md:p-6 border border-outline-variant/10 hover:border-outline-variant/20 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Brand icon placeholder */}
                  <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-xl">storefront</span>
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-base text-on-background">{sub.brand}</h3>
                    <p className="text-on-surface-variant text-sm">{sub.plan}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-primary font-headline font-black text-sm">{sub.discount}</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full ${
                      sub.status === "Active"
                        ? "bg-primary-container/40 text-primary border border-primary/15"
                        : "bg-surface-container text-on-surface-variant border border-outline-variant/20"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">
                      {sub.status === "Active" ? "check_circle" : "pause_circle"}
                    </span>
                    {sub.status}
                  </span>
                  {sub.status === "Active" && (
                    <span className="text-xs text-on-surface-variant/50 hidden sm:inline">
                      Renews {sub.renewsOn}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account Settings */}
      {activeTab === "settings" && (
        <div className="animate-modal-enter max-w-2xl">
          <div className="mb-6">
            <h2 className="font-headline font-extrabold text-2xl tracking-tighter text-on-background">
              Account Settings
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">
              Manage your email, password, and notification preferences.
            </p>
          </div>

          <form onSubmit={handleSettingsSave} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={settingsEmail}
                onChange={(e) => setSettingsEmail(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                New Password
              </label>
              <input
                type="password"
                placeholder="Leave blank to keep current"
                value={settingsPassword}
                onChange={(e) => setSettingsPassword(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
              />
            </div>

            {/* Notifications */}
            <div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/10">
              <h3 className="font-headline font-bold text-sm text-on-background mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">notifications</span>
                Notification Preferences
              </h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-headline font-bold text-sm text-on-surface">New Deal Alerts</p>
                    <p className="text-xs text-on-surface-variant/60">
                      Get notified when new student deals are posted.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifyDeals(!notifyDeals)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notifyDeals ? "bg-primary" : "bg-outline-variant/30"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        notifyDeals ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-headline font-bold text-sm text-on-surface">Weekly Newsletter</p>
                    <p className="text-xs text-on-surface-variant/60">
                      Curated deals and brand spotlights every Monday.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifyNewsletter(!notifyNewsletter)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notifyNewsletter ? "bg-primary" : "bg-outline-variant/30"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        notifyNewsletter ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
              </div>
            </div>

            {/* Save button */}
            <button
              type="submit"
              className={`px-8 py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md active:scale-[0.98] transition-all ${
                settingsSaved
                  ? "bg-primary text-on-primary"
                  : "emerald-gradient text-on-primary hover:shadow-lg"
              }`}
            >
              {settingsSaved ? (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Saved!
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

export default Profile;
