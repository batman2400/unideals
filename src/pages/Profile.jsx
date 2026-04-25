/**
 * Profile Page (/profile)
 *
 * UniDays-inspired user dashboard with:
 *   - Profile picture upload (Supabase Storage)
 *   - Verification badge with glow animation
 *   - Glassmorphic Student ID Card
 *   - University email verification in Settings
 *   - Tabbed content: Saved Deals, Subscriptions, Settings
 *
 * Props:
 *   - isLoggedIn : boolean
 *   - user       : object|null — Supabase user object
 */
import { useState, useEffect, useRef } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useDeals } from "../lib/useDeals";
import { useRole } from "../lib/useRole";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";

// Simulated active in-store subscriptions
const activeSubscriptions = [
  { id: 1, brand: "Brew & Co.", plan: "Student Monthly Pass", status: "Active", renewsOn: "May 15, 2026", discount: "15% OFF" },
  { id: 2, brand: "Nexus Fitness", plan: "All-Access Free Month", status: "Active", renewsOn: "May 01, 2026", discount: "FREE MONTH" },
  { id: 3, brand: "ThreadLine", plan: "Campus Essentials Club", status: "Paused", renewsOn: "—", discount: "35% OFF" },
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

  const { deals, loading: dealsLoading, error: dealsError } = useDeals();
  const { isVerified, loading: verificationLoading, refreshRole } = useRole();

  // ── Saved deals ─────────────────────────────────────
  const [savedDealIds, setSavedDealIds] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState(null);

  useEffect(() => {
    let active = true;
    async function fetchSaved() {
      if (!user) { setSavedError(null); setSavedLoading(false); return; }
      setSavedLoading(true); setSavedError(null);
      const { data, error } = await supabase.from("saved_deals").select("deal_id").eq("user_id", user.id);
      if (active && !error) { setSavedDealIds(data ? data.map(d => d.deal_id) : []); setSavedError(null); setSavedLoading(false); }
      else if (active && error) { console.error("Error fetching saved deals:", error); setSavedError(error.message || "Could not load your saved deals."); setSavedLoading(false); }
    }
    fetchSaved();
    return () => { active = false; };
  }, [user]);

  const savedDeals = deals.filter((d) => savedDealIds.includes(d.id));

  // ── Avatar upload ───────────────────────────────────
  const fileInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: urlWithCacheBust } });
      if (updateError) throw updateError;
      setAvatarUrl(urlWithCacheBust);
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── University email verification ───────────────────
  const [uniEmail, setUniEmail] = useState("");
  const [uniVerifying, setUniVerifying] = useState(false);
  const [uniError, setUniError] = useState("");
  const [uniSuccess, setUniSuccess] = useState(false);

  const handleUniVerify = async (e) => {
    e.preventDefault();
    setUniError(""); setUniSuccess(false);
    const normalized = uniEmail.trim().toLowerCase();
    if (!normalized.includes("@")) { setUniError("Please enter a valid email address."); return; }
    if (!(normalized.endsWith(".ac.lk") || normalized.endsWith(".edu.lk") || normalized.endsWith(".edu"))) {
      setUniError("Email must end with .ac.lk, .edu.lk, or .edu"); return;
    }
    setUniVerifying(true);
    try {
      const { data, error } = await supabase.rpc("verify_university_email", { uni_email: normalized });
      if (error) throw error;
      if (data?.success) { setUniSuccess(true); refreshRole(); }
      else { setUniError(data?.error || "Verification failed."); }
    } catch (err) { setUniError(err.message || "An error occurred."); }
    finally { setUniVerifying(false); }
  };

  // ── User info derivation ────────────────────────────
  const userEmail = user?.email ?? "user@example.com";
  const fullName = user?.user_metadata?.full_name || userEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const initials = fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—";
  const studentRef = user?.id ? user.id.slice(0, 8).toUpperCase() : "—";

  // ── Settings form state ─────────────────────────────
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

  if (!isLoggedIn) return <Navigate to="/" replace />;

  return (
    <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16">
      {/* ── Profile Header ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8 mb-8">
        {/* Avatar with upload */}
        <div className="relative avatar-upload-container flex-shrink-0">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden shadow-lg">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full emerald-gradient flex items-center justify-center">
                <span className="text-on-primary font-headline font-black text-3xl md:text-4xl">{initials}</span>
              </div>
            )}
            {/* Upload overlay */}
            <div className="avatar-upload-overlay rounded-2xl" onClick={() => fileInputRef.current?.click()}>
              {avatarUploading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
              )}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          {/* Verified mini badge on avatar */}
          {!verificationLoading && isVerified && (
            <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-background flex items-center justify-center shadow-md verified-glow">
              <span className="material-symbols-outlined text-primary text-base verified-icon-glow" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background">{fullName}</h1>
            {verificationLoading ? (
              <span className="inline-flex items-center gap-1.5 bg-surface-container-low text-on-surface-variant border border-outline-variant/20 text-xs font-bold px-3 py-1.5 rounded-full">
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                Checking Status
              </span>
            ) : isVerified ? (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/25 text-xs font-bold px-3 py-1.5 rounded-full shadow-[0_0_26px_rgba(41,105,91,0.28)]">
                <span className="material-symbols-outlined text-sm verified-icon-glow" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                Verified Student
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-surface-container-low text-on-surface-variant border border-outline-variant/25 text-xs font-bold px-3 py-1.5 rounded-full">
                <span className="material-symbols-outlined text-sm">gpp_maybe</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#d4a017] amber-pulse" />
                Unverified
              </span>
            )}
          </div>
          <p className="text-on-surface-variant text-base md:text-lg mb-3">{userEmail}</p>
          <div className="flex flex-wrap items-center gap-3">
            {!verificationLoading && !isVerified && (
              <button type="button" onClick={() => setActiveTab("settings")} className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant/70 hover:text-primary border border-outline-variant/25 px-3 py-1.5 rounded-full transition-colors">
                <span className="material-symbols-outlined text-sm">id_card</span>
                Verify Student Status
              </button>
            )}
            {!verificationLoading && isVerified && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary/90 bg-primary/10 border border-primary/15 px-3 py-1.5 rounded-full">
                <span className="material-symbols-outlined text-sm">lock_open</span>
                Deal codes unlocked
              </span>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-6 md:gap-8 flex-shrink-0">
          {[
            { value: savedDeals.length, label: "Saved", color: "text-on-background" },
            { value: activeSubscriptions.filter((s) => s.status === "Active").length, label: "Active", color: "text-on-background" },
            { value: 12, label: "Claimed", color: "text-primary" },
          ].map((stat, i) => (
            <div key={stat.label} className="text-center animate-count-up" style={{ animationDelay: `${i * 100}ms` }}>
              <p className={`font-headline font-black text-2xl ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-on-surface-variant/60 font-bold uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Student ID Card ────────────────────────────── */}
      <div className="id-card-glass rounded-2xl p-5 md:p-6 mb-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full emerald-gradient flex items-center justify-center">
                <span className="text-on-primary font-headline font-black text-sm">{initials}</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-headline font-bold text-sm text-on-background truncate">{fullName}</p>
            <p className="text-xs text-on-surface-variant/60 truncate">Uni Deals iD</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 sm:gap-8 text-xs">
          <div>
            <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">Status</p>
            <p className="font-headline font-bold text-on-background flex items-center gap-1.5">
              {isVerified ? (
                <><span className="w-2 h-2 rounded-full bg-primary" />Verified</>
              ) : (
                <><span className="w-2 h-2 rounded-full bg-[#d4a017] amber-pulse" />Pending</>
              )}
            </p>
          </div>
          <div>
            <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">Member Since</p>
            <p className="font-headline font-bold text-on-background">{memberSince}</p>
          </div>
          <div>
            <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">Reference</p>
            <p className="font-headline font-bold text-on-background font-mono tracking-wider">#{studentRef}</p>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────── */}
      <div className="flex gap-1 bg-surface-container-low rounded-xl p-1 mb-10 overflow-x-auto">
        {tabConfig.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 text-sm font-headline font-bold tracking-tight rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab.key ? "bg-primary text-on-primary shadow-md" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────── */}

      {/* Saved Deals */}
      {activeTab === "saved" && (
        <div className="animate-modal-enter">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-headline font-extrabold text-2xl tracking-tighter text-on-background">Saved Deals</h2>
              <p className="text-on-surface-variant text-sm mt-1">Your bookmarked offers — ready when you are.</p>
            </div>
            <Link to="/perks" className="hidden sm:inline-flex items-center gap-1 text-sm text-primary font-headline font-bold hover:underline">
              Browse more <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
          {(dealsLoading || dealsError || savedLoading) ? (
            <DealsLoader loading={dealsLoading || savedLoading} error={dealsError || savedError} />
          ) : (
            <DealGrid deals={savedDeals} />
          )}
        </div>
      )}

      {/* Active Subscriptions */}
      {activeTab === "subscriptions" && (
        <div className="animate-modal-enter">
          <div className="mb-6">
            <h2 className="font-headline font-extrabold text-2xl tracking-tighter text-on-background">Active Subscriptions</h2>
            <p className="text-on-surface-variant text-sm mt-1">Your ongoing in-store memberships and plans.</p>
          </div>
          <div className="space-y-4">
            {activeSubscriptions.map((sub) => (
              <div key={sub.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-container-low rounded-xl p-5 md:p-6 border border-outline-variant/10 hover:border-outline-variant/20 transition-colors">
                <div className="flex items-center gap-4">
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
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full ${sub.status === "Active" ? "bg-primary-container/40 text-primary border border-primary/15" : "bg-surface-container text-on-surface-variant border border-outline-variant/20"}`}>
                    <span className="material-symbols-outlined text-xs">{sub.status === "Active" ? "check_circle" : "pause_circle"}</span>
                    {sub.status}
                  </span>
                  {sub.status === "Active" && <span className="text-xs text-on-surface-variant/50 hidden sm:inline">Renews {sub.renewsOn}</span>}
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
            <h2 className="font-headline font-extrabold text-2xl tracking-tighter text-on-background">Account Settings</h2>
            <p className="text-on-surface-variant text-sm mt-1">Manage your email, password, and notification preferences.</p>
          </div>

          {/* University Email Verification */}
          {!isVerified && (
            <div className="bg-primary-container/15 border border-primary/15 rounded-xl p-5 md:p-6 mb-8 animate-modal-enter">
              <div className="flex items-start gap-3 mb-4">
                <span className="material-symbols-outlined text-primary text-2xl mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                <div>
                  <h3 className="font-headline font-bold text-base text-on-background">Verify Your Student Status</h3>
                  <p className="text-on-surface-variant text-sm mt-1">Add your university email to unlock all deal codes and in-store perks.</p>
                </div>
              </div>
              <form onSubmit={handleUniVerify} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email" placeholder="you@university.edu" value={uniEmail}
                  onChange={(e) => setUniEmail(e.target.value)} disabled={uniVerifying}
                  className="flex-1 bg-surface border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all disabled:opacity-50"
                />
                <button type="submit" disabled={uniVerifying}
                  className="emerald-gradient text-on-primary px-6 py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {uniVerifying ? (<><div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />Verifying...</>) : "Verify Email"}
                </button>
              </form>
              {uniError && (
                <div className="flex items-center gap-2 mt-3 text-error text-xs font-bold">
                  <span className="material-symbols-outlined text-xs">error</span>{uniError}
                </div>
              )}
            </div>
          )}

          {/* Uni email verification success */}
          {uniSuccess && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 mb-8 animate-modal-enter">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center confetti-burst">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>celebration</span>
                </div>
                <div>
                  <p className="font-headline font-bold text-sm text-on-background">Student Status Verified! 🎉</p>
                  <p className="text-on-surface-variant text-xs mt-0.5">You now have full access to all deal codes and in-store perks.</p>
                </div>
              </div>
            </div>
          )}

          {/* Verified university email display */}
          {isVerified && !uniSuccess && (
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-5 mb-8 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              <div>
                <p className="font-headline font-bold text-sm text-on-background">Student Status Verified</p>
                <p className="text-on-surface-variant text-xs mt-0.5">Full access to all deal codes and in-store perks.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSettingsSave} className="space-y-6">
            <div>
              <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">Email Address</label>
              <input type="email" value={settingsEmail} onChange={(e) => setSettingsEmail(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">New Password</label>
              <input type="password" placeholder="Leave blank to keep current" value={settingsPassword} onChange={(e) => setSettingsPassword(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
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
                    <p className="text-xs text-on-surface-variant/60">Get notified when new student deals are posted.</p>
                  </div>
                  <button type="button" onClick={() => setNotifyDeals(!notifyDeals)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifyDeals ? "bg-primary" : "bg-outline-variant/30"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${notifyDeals ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-headline font-bold text-sm text-on-surface">Weekly Newsletter</p>
                    <p className="text-xs text-on-surface-variant/60">Curated deals and brand spotlights every Monday.</p>
                  </div>
                  <button type="button" onClick={() => setNotifyNewsletter(!notifyNewsletter)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifyNewsletter ? "bg-primary" : "bg-outline-variant/30"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${notifyNewsletter ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </label>
              </div>
            </div>

            <button type="submit"
              className={`px-8 py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md active:scale-[0.98] transition-all ${settingsSaved ? "bg-primary text-on-primary" : "emerald-gradient text-on-primary hover:shadow-lg"}`}>
              {settingsSaved ? (<span className="flex items-center gap-2"><span className="material-symbols-outlined text-lg">check_circle</span>Saved!</span>) : "Save Changes"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

export default Profile;
