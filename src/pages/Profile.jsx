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
import { useRoleContext } from "../lib/RoleContext";
import DealGrid from "../components/DealGrid";
import DealsLoader from "../components/DealsLoader";

// No subscriptions for now

const tabConfig = [
  { key: "saved", label: "Saved Deals", icon: "bookmark" },
  { key: "settings", label: "Settings", icon: "settings" },
];

function Profile({ isLoggedIn, user }) {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "saved";
  const [activeTab, setActiveTab] = useState(initialTab);

  const { deals, loading: dealsLoading, error: dealsError } = useDeals();
  const {
    isVerified,
    role,
    loading: verificationLoading,
    refreshRole,
  } = useRoleContext();

  // ── Saved deals ─────────────────────────────────────
  const [savedDealIds, setSavedDealIds] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState(null);

  useEffect(() => {
    let active = true;
    async function fetchSaved() {
      if (!user) {
        setSavedError(null);
        setSavedLoading(false);
        return;
      }
      setSavedLoading(true);
      setSavedError(null);
      const { data, error } = await supabase
        .from("saved_deals")
        .select("deal_id")
        .eq("user_id", user.id);
      if (active && !error) {
        setSavedDealIds(data ? data.map((d) => d.deal_id) : []);
        setSavedError(null);
        setSavedLoading(false);
      } else if (active && error) {
        console.error("Error fetching saved deals:", error);
        setSavedError(error.message || "Could not load your saved deals.");
        setSavedLoading(false);
      }
    }
    fetchSaved();
    return () => {
      active = false;
    };
  }, [user]);

  const savedDeals = deals.filter((d) => savedDealIds.includes(d.id));

  // ── Avatar upload ───────────────────────────────────
  const fileInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(
    user?.user_metadata?.avatar_url || null,
  );
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: urlWithCacheBust },
      });
      if (updateError) throw updateError;
      setAvatarUrl(urlWithCacheBust);
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── University email verification ───────────────────
  const [verificationStep, setVerificationStep] = useState(1);
  const [uniEmail, setUniEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [uniVerifying, setUniVerifying] = useState(false);
  const [uniError, setUniError] = useState("");
  const [uniSuccess, setUniSuccess] = useState(false);

  // ── Manual Verification ───────────────────────────────
  const [showManualVerification, setShowManualVerification] = useState(false);
  const [manualInstType, setManualInstType] = useState("university");
  const [manualInstName, setManualInstName] = useState("");
  const [manualCourse, setManualCourse] = useState("");
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualFile, setManualFile] = useState(null);
  const [manualVerifying, setManualVerifying] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState(false);

  // Pending verification status (single source of truth)
  const [hasPendingVerification, setHasPendingVerification] = useState(false);

  // Settings ref for smooth scrolling
  const settingsRef = useRef(null);

  const scrollToSettings = () => {
    setActiveTab("settings");
    setTimeout(() => {
      settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };
  
  // Custom allowed domains from backend
  const [allowedDomains, setAllowedDomains] = useState([]);
  
  // Countdown timer for resend OTP
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let active = true;
    async function fetchAllowedDomains() {
      const { data, error } = await supabase.from('allowed_domains').select('domain');
      if (active && !error && data) {
        setAllowedDomains(data.map(d => d.domain.toLowerCase()));
      }
    }
    fetchAllowedDomains();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchPendingVerification() {
      if (!user) return;
      const { data, error } = await supabase
        .from('manual_verifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .limit(1);
      
      if (active && !error && data && data.length > 0) {
        setHasPendingVerification(true);
      }
    }
    fetchPendingVerification();
    return () => { active = false; };
  }, [user, manualSuccess]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRequestVerification = async (e) => {
    e?.preventDefault();
    setUniError("");
    setUniSuccess(false);
    
    const normalized = uniEmail.trim().toLowerCase();
    if (!normalized.includes("@")) {
      setUniError("Please enter a valid email address.");
      return;
    }
    
    const domainPart = normalized.split("@")[1];
    const isUniversalSuffix = 
      normalized.endsWith(".ac.lk") ||
      normalized.endsWith(".edu.lk") ||
      normalized.endsWith(".sliit.lk") ||
      normalized.endsWith(".edu") ||
      normalized.endsWith(".edu.au") ||
      normalized.endsWith(".ac.uk");
      
    const isCustomDomain = allowedDomains.includes(domainPart);
    
    if (!isUniversalSuffix && !isCustomDomain) {
      setUniError("Please use your official university or institutional student email address.");
      return;
    }
    
    setUniVerifying(true);
    try {
      const { data, error } = await supabase.rpc("request_university_verification", {
        target_email: normalized,
      });
      if (error) throw error;
      if (data?.success) {
        setVerificationStep(2);
        setResendCooldown(60); // 60 seconds cooldown
        // Note: For beta testing, we could log the OTP here. 
        console.log("OTP for testing:", data.otp);
      } else {
        setUniError(data?.error || "Failed to request verification.");
      }
    } catch (err) {
      setUniError(err.message || "An error occurred.");
    } finally {
      setUniVerifying(false);
    }
  };

  const handleConfirmVerification = async (e) => {
    e.preventDefault();
    setUniError("");
    
    if (otpCode.length !== 6) {
      setUniError("Please enter a valid 6-digit code.");
      return;
    }
    
    setUniVerifying(true);
    try {
      const { data, error } = await supabase.rpc("confirm_university_verification", {
        entered_email: uniEmail.trim().toLowerCase(),
        entered_code: otpCode,
      });
      if (error) throw error;
      if (data?.success) {
        setUniSuccess(true);
        refreshRole();
      } else {
        setUniError(data?.error || "Verification failed.");
      }
    } catch (err) {
      setUniError(err.message || "An error occurred.");
    } finally {
      setUniVerifying(false);
    }
  };

  const handleResendOtp = () => {
    if (resendCooldown === 0) {
      handleRequestVerification();
    }
  };

  const handleManualVerify = async (e) => {
    e.preventDefault();
    setManualError("");
    
    if (!manualInstName.trim() || !manualFile) {
      setManualError("Institution name and proof document are required.");
      return;
    }
    
    if (manualInstType === "university" && (!manualCourse.trim() || !manualStudentId.trim())) {
      setManualError("Course details and Student ID are required for University verification.");
      return;
    }

    // Check file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(manualFile.type)) {
      setManualError("Please upload a valid image file (JPEG, PNG, or WEBP).");
      return;
    }

    setManualVerifying(true);
    
    try {
      // 1. Upload file to Supabase Storage
      const fileExt = manualFile.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('verification-documents')
        .upload(filePath, manualFile);
        
      if (uploadError) throw uploadError;
      
      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('verification-documents')
        .getPublicUrl(filePath);
        
      const imageUrl = publicUrlData.publicUrl;
      
      // 3. Call RPC submit_manual_verification
      const { data, error } = await supabase.rpc("submit_manual_verification", {
        inst_type: manualInstType,
        inst_name: manualInstName.trim(),
        course: manualCourse.trim(),
        student_id: manualStudentId.trim(),
        email: user?.email || "unknown@example.com",
        image_url: imageUrl
      });
      
      if (error) throw error;
      
      if (data?.success) {
        setManualSuccess(true);
        setShowManualVerification(false);
      } else {
        setManualError(data?.error || "Failed to submit verification request.");
      }
    } catch (err) {
      setManualError(err.message || "An error occurred during submission.");
    } finally {
      setManualVerifying(false);
    }
  };

  // ── User info derivation ────────────────────────────
  const userEmail = user?.email ?? "user@example.com";
  const fullName =
    user?.user_metadata?.full_name ||
    userEmail
      .split("@")[0]
      .replace(/[._]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  const initials = fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "—";
  const studentRef = user?.id ? user.id.slice(0, 8).toUpperCase() : "—";

  // ── Settings form state ─────────────────────────────
  const [settingsEmail, setSettingsEmail] = useState(userEmail);
  const [settingsPassword, setSettingsPassword] = useState("");
  const [notifyDeals, setNotifyDeals] = useState(true);
  const [notifyNewsletter, setNotifyNewsletter] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    setSettingsError("");
    setSettingsSaving(true);
    try {
      const updates = {};
      if (settingsEmail && settingsEmail !== userEmail) {
        updates.email = settingsEmail;
      }
      if (settingsPassword) {
        updates.password = settingsPassword;
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.auth.updateUser(updates);
        if (error) throw error;
      }
      setSettingsSaved(true);
      setSettingsPassword("");
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (err) {
      setSettingsError(err.message || "Failed to save settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  if (!isLoggedIn) return <Navigate to="/" replace />;

  return (
    <section className="max-w-[1440px] mx-auto px-4 py-6 md:px-8 md:py-16">
      {/* ── Profile Header ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8 mb-8">
        {/* Avatar with upload */}
        <div className="relative avatar-upload-container flex-shrink-0">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden shadow-lg">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full emerald-gradient flex items-center justify-center">
                <span className="text-on-primary font-headline font-black text-3xl md:text-4xl">
                  {initials}
                </span>
              </div>
            )}
            {/* Upload overlay */}
            <div
              className="avatar-upload-overlay rounded-2xl"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarUploading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-white text-2xl">
                  photo_camera
                </span>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          {/* Verified mini badge on avatar */}
          {!verificationLoading &&
            (isVerified || role === "admin" || role === "partner") && (
              <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-background flex items-center justify-center shadow-md verified-glow">
                <span
                  className="material-symbols-outlined text-primary text-base verified-icon-glow"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {role === "admin" ? "verified_user" : "verified"}
                </span>
              </div>
            )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background">
              {fullName}
            </h1>
            {verificationLoading ? (
              <span className="inline-flex items-center gap-1.5 bg-surface-container-low text-on-surface-variant border border-outline-variant/20 text-xs font-bold px-3 py-1.5 rounded-full">
                <span className="material-symbols-outlined text-sm animate-spin">
                  progress_activity
                </span>
                Checking Status
              </span>
            ) : role === "admin" ? (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/25 text-xs font-bold px-3 py-1.5 rounded-full shadow-[0_0_26px_rgba(41,105,91,0.28)]">
                <span
                  className="material-symbols-outlined text-sm verified-icon-glow"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified_user
                </span>
                Verified Admin
              </span>
            ) : role === "partner" ? (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/25 text-xs font-bold px-3 py-1.5 rounded-full shadow-[0_0_26px_rgba(41,105,91,0.28)]">
                <span
                  className="material-symbols-outlined text-sm verified-icon-glow"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
                Verified Brand
              </span>
            ) : isVerified ? (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/25 text-xs font-bold px-3 py-1.5 rounded-full shadow-[0_0_26px_rgba(41,105,91,0.28)]">
                <span
                  className="material-symbols-outlined text-sm verified-icon-glow"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
                Verified Student
              </span>
            ) : hasPendingVerification ? (
              <button
                type="button"
                onClick={scrollToSettings}
                className="inline-flex items-center gap-1.5 bg-[#d4a017]/10 text-[#b58711] border border-[#d4a017]/25 text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer active:scale-95 touch-manipulation transition hover:bg-[#d4a017]/20"
              >
                <span className="material-symbols-outlined text-sm">
                  pending_actions
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#d4a017] amber-pulse" />
                Pending Review
              </button>
            ) : (
              <button
                type="button"
                onClick={scrollToSettings}
                className="inline-flex items-center gap-1.5 bg-surface-container-low text-on-surface-variant border border-outline-variant/25 text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer active:scale-95 touch-manipulation transition hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-sm">
                  gpp_maybe
                </span>
                Unverified
              </button>
            )}
          </div>
          <p className="text-on-surface-variant text-base md:text-lg mb-3">
            {userEmail}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {!verificationLoading && role === "student" && !isVerified && !hasPendingVerification && (
              <button
                type="button"
                onClick={scrollToSettings}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant/70 hover:text-primary border border-outline-variant/25 px-3 py-1.5 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined text-sm">
                  id_card
                </span>
                Verify Student Status
              </button>
            )}
            {!verificationLoading &&
              (isVerified || role === "admin" || role === "partner") && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary/90 bg-primary/10 border border-primary/15 px-3 py-1.5 rounded-full">
                  <span className="material-symbols-outlined text-sm">
                    lock_open
                  </span>
                  Deal codes unlocked
                </span>
              )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-6 md:gap-8 flex-shrink-0">
          {[
            {
              value: savedDeals.length,
              label: "Saved",
              color: "text-on-background",
            },
            { value: "—", label: "Active", color: "text-on-background" },
            { value: "—", label: "Claimed", color: "text-primary" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="text-center animate-count-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <p className={`font-headline font-black text-2xl ${stat.color}`}>
                {stat.value}
              </p>
              <p className="text-xs text-on-surface-variant/60 font-bold uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Student ID Card ────────────────────────────── */}
      <div className="id-card-glass rounded-2xl p-5 md:p-6 mb-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 w-full max-w-sm mx-auto md:max-w-none">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full emerald-gradient flex items-center justify-center">
                <span className="text-on-primary font-headline font-black text-sm">
                  {initials}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-headline font-bold text-sm text-on-background truncate">
              {fullName}
            </p>
            <p className="text-xs text-on-surface-variant/60 truncate">
              Uni Deals iD
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 sm:gap-8 text-xs">
          <div>
            <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">
              Status
            </p>
            <p className="font-headline font-bold text-on-background flex items-center gap-1.5">
              {isVerified || role === "admin" || role === "partner" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Verified
                </>
              ) : hasPendingVerification ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#d4a017] amber-pulse" />
                  Pending Review
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-on-surface-variant/40" />
                  Unverified
                </>
              )}
            </p>
          </div>
          <div>
            <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">
              Member Since
            </p>
            <p className="font-headline font-bold text-on-background">
              {memberSince}
            </p>
          </div>
          <div>
            <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">
              Reference
            </p>
            <p className="font-headline font-bold text-on-background font-mono tracking-wider">
              #{studentRef}
            </p>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────── */}
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
            <span className="material-symbols-outlined text-lg">
              {tab.icon}
            </span>
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
              Browse more{" "}
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </Link>
          </div>
          {dealsLoading || dealsError || savedLoading ? (
            <DealsLoader
              loading={dealsLoading || savedLoading}
              error={dealsError || savedError}
            />
          ) : (
            <DealGrid deals={savedDeals} />
          )}
        </div>
      )}



      {/* Account Settings */}
      {activeTab === "settings" && (
        <div ref={settingsRef} className="animate-modal-enter max-w-2xl">
          <div className="mb-6">
            <h2 className="font-headline font-extrabold text-2xl tracking-tighter text-on-background">
              Account Settings
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">
              Manage your email, password, and notification preferences.
            </p>
          </div>

          {/* University Email Verification */}
          {role === "student" && !isVerified && (
            <div className="bg-primary-container/15 border border-primary/15 rounded-xl p-5 md:p-6 mb-8 animate-modal-enter">
              <div className="flex items-start gap-3 mb-4">
                <span
                  className="material-symbols-outlined text-primary text-2xl mt-0.5"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  school
                </span>
                <div>
                  <h3 className="font-headline font-bold text-base text-on-background">
                    Verify Your Student Status
                  </h3>
                  <p className="text-on-surface-variant text-sm mt-1">
                    Add your university email to unlock all deal codes and
                    in-store perks.
                  </p>
                </div>
              </div>
              {verificationStep === 1 ? (
                <form
                  onSubmit={handleRequestVerification}
                  className="flex flex-col sm:flex-row gap-3 animate-fade-in"
                >
                  <input
                    type="email"
                    placeholder="you@university.edu"
                    value={uniEmail}
                    onChange={(e) => setUniEmail(e.target.value)}
                    disabled={uniVerifying}
                    className="flex-1 bg-surface border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={uniVerifying}
                    className="emerald-gradient text-on-primary px-6 py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {uniVerifying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Code"
                    )}
                  </button>
                </form>
              ) : (
                <div className="animate-fade-in space-y-3">
                  <form
                    onSubmit={handleConfirmVerification}
                    className="flex flex-col sm:flex-row gap-3"
                  >
                    <input
                      type="text"
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      disabled={uniVerifying}
                      className="flex-1 bg-surface border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body text-center tracking-widest focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={uniVerifying || otpCode.length !== 6}
                      className="emerald-gradient text-on-primary px-6 py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      {uniVerifying ? (
                        <>
                          <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify Code"
                      )}
                    </button>
                  </form>
                  <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant px-1">
                    <span>Sent to {uniEmail}</span>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0 || uniVerifying}
                      className="text-primary hover:underline disabled:text-on-surface-variant/50 disabled:no-underline transition-colors"
                    >
                      {resendCooldown > 0
                        ? `Resend available in ${resendCooldown}s`
                        : "Resend Code"}
                    </button>
                  </div>
                </div>
              )}
              {uniError && (
                <div className="flex items-center gap-2 mt-3 text-error text-xs font-bold">
                  <span className="material-symbols-outlined text-xs">
                    error
                  </span>
                  {uniError}
                </div>
              )}

              {/* Fallback toggle */}
              <div className="mt-4 pt-4 border-t border-outline-variant/10 text-center">
                <button
                  type="button"
                  onClick={() => setShowManualVerification(!showManualVerification)}
                  className="text-primary text-xs font-bold hover:underline transition-all"
                >
                  {showManualVerification ? "Hide Manual Verification" : "Can't verify via email? Request Manual Verification"}
                </button>
              </div>

              {/* Manual Verification Form */}
              {showManualVerification && (
                <div className="mt-5 p-4 border border-outline-variant/20 bg-surface rounded-xl animate-fade-in">
                  <h4 className="font-headline font-bold text-sm text-on-background mb-3">Manual Verification Request</h4>
                  <form onSubmit={handleManualVerify} className="space-y-3">
                    <select
                      value={manualInstType}
                      onChange={(e) => setManualInstType(e.target.value)}
                      disabled={manualVerifying}
                      className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    >
                      <option value="university">University / College</option>
                      <option value="school">High School</option>
                    </select>

                    <input
                      type="text"
                      placeholder={manualInstType === "school" ? "School Name" : "University Name"}
                      value={manualInstName}
                      onChange={(e) => setManualInstName(e.target.value)}
                      disabled={manualVerifying}
                      className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    />

                    {manualInstType === "university" && (
                      <>
                        <input
                          type="text"
                          placeholder="Course Details (e.g. BSc Computer Science)"
                          value={manualCourse}
                          onChange={(e) => setManualCourse(e.target.value)}
                          disabled={manualVerifying}
                          className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Student ID Number"
                          value={manualStudentId}
                          onChange={(e) => setManualStudentId(e.target.value)}
                          disabled={manualVerifying}
                          className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                        />
                      </>
                    )}

                    <div className="pt-2">
                      <p className="text-xs text-on-surface-variant font-bold mb-1">
                        {manualInstType === "school" ? "Upload Photo Proof of Enrollment (JPEG/PNG/WEBP)" : "Upload University ID Card (JPEG/PNG/WEBP)"}
                      </p>
                      <input
                        type="file"
                        accept="image/jpeg, image/png, image/webp"
                        onChange={(e) => setManualFile(e.target.files[0])}
                        disabled={manualVerifying}
                        className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                      />
                    </div>

                    {manualError && (
                      <div className="flex items-center gap-2 mt-2 text-error text-xs font-bold">
                        <span className="material-symbols-outlined text-xs">error</span>
                        {manualError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={manualVerifying}
                      className="w-full mt-3 bg-primary text-on-primary py-2.5 rounded-lg font-headline font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {manualVerifying ? (
                        <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "Submit Request"
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Uni email verification success */}
          {uniSuccess && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 mb-8 animate-modal-enter">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center confetti-burst">
                  <span
                    className="material-symbols-outlined text-primary text-xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    celebration
                  </span>
                </div>
                <div>
                  <p className="font-headline font-bold text-sm text-on-background">
                    Student Status Verified! 🎉
                  </p>
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    You now have full access to all deal codes and in-store
                    perks.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Manual verification submitted success */}
          {manualSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 mb-8 animate-modal-enter">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-emerald-600 text-xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    hourglass_top
                  </span>
                </div>
                <div>
                  <p className="font-headline font-bold text-sm text-on-background">
                    Verification Request Submitted
                  </p>
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    Our team will review your document shortly. We'll email you once your status is approved.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Verified university email display */}
          {(isVerified || role === "admin" || role === "partner") &&
            !uniSuccess && (
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-5 mb-8 flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-primary text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
                <div>
                  <p className="font-headline font-bold text-sm text-on-background">
                    {role === "admin"
                      ? "Admin Status Verified"
                      : role === "partner"
                        ? "Brand Status Verified"
                        : "Student Status Verified"}
                  </p>
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    Full access to all deal codes and in-store perks.
                  </p>
                </div>
              </div>
            )}

          <form onSubmit={handleSettingsSave} className="space-y-6">
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
                <span className="material-symbols-outlined text-primary text-lg">
                  notifications
                </span>
                Notification Preferences
              </h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-headline font-bold text-sm text-on-surface">
                      New Deal Alerts
                    </p>
                    <p className="text-xs text-on-surface-variant/60">
                      Get notified when new student deals are posted.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifyDeals(!notifyDeals)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifyDeals ? "bg-primary" : "bg-outline-variant/30"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${notifyDeals ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-headline font-bold text-sm text-on-surface">
                      Weekly Newsletter
                    </p>
                    <p className="text-xs text-on-surface-variant/60">
                      Curated deals and brand spotlights every Monday.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifyNewsletter(!notifyNewsletter)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifyNewsletter ? "bg-primary" : "bg-outline-variant/30"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${notifyNewsletter ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </label>
              </div>
            </div>

            {settingsError && (
              <div className="flex items-center gap-2 text-error text-xs font-bold">
                <span className="material-symbols-outlined text-xs">error</span>
                {settingsError}
              </div>
            )}

            <button
              type="submit"
              disabled={settingsSaving}
              className={`px-8 py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md active:scale-[0.98] transition-all disabled:opacity-60 ${settingsSaved ? "bg-primary text-on-primary" : "emerald-gradient text-on-primary hover:shadow-lg"}`}
            >
              {settingsSaving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : settingsSaved ? (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">
                    check_circle
                  </span>
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
