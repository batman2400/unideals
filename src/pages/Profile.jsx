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
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useRoleContext } from "../lib/RoleContext";
import { PASSWORD_HINT, validatePasswordStrength } from "../lib/passwordPolicy";
import { OFFICIAL_CATEGORIES } from "../lib/categories";
import { asHttpUrl } from "../lib/httpUrl";
import { uploadBrandLogo } from "../lib/brandLogoUpload";
import StudentVerificationCard from "../components/StudentVerificationCard";
import { formatVerificationExpiry } from "../lib/studentVerification";
import { QRCodeSVG } from "qrcode.react";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validateImageUpload(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Please upload a JPEG, PNG, or WEBP image.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 5MB.`;
  }
  return null;
}

function getAccountEmail(user) {
  if (!user) return "";
  if (user.email) return user.email;
  const metaEmail = user.user_metadata?.email;
  if (typeof metaEmail === "string" && metaEmail.includes("@")) return metaEmail;
  const identity = user.identities?.find((item) => item?.identity_data?.email);
  return identity?.identity_data?.email || "";
}

function linkedBrandFromProfile(row) {
  // No brand_id means the account is not assigned. Never pick a random
  // brands(*) row (that was filling in UniDeals for unassigned partners).
  if (!row?.brand_id) return null;
  const candidates = Array.isArray(row.brands)
    ? row.brands
    : row.brands
      ? [row.brands]
      : [];
  const embedded = candidates.find((brand) => brand?.id === row.brand_id) || null;
  return {
    id: row.brand_id,
    name: embedded?.name || row.brand_name || "",
    logo_url: embedded?.logo_url || "",
    category: embedded?.category || "",
    description: embedded?.description || "",
    website_url: embedded?.website_url || "",
    instagram_handle: embedded?.instagram_handle || "",
    tiktok_handle: embedded?.tiktok_handle || "",
    location: embedded?.location || "",
  };
}

function brandToForm(brand) {
  return {
    name: brand?.name || "",
    category: brand?.category || "",
    description: brand?.description || "",
    website_url: brand?.website_url || "",
    instagram_handle: brand?.instagram_handle || "",
    tiktok_handle: brand?.tiktok_handle || "",
    location: brand?.location || "",
  };
}

function socialHref(handle, host) {
  if (!handle) return null;
  const trimmed = String(handle).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return asHttpUrl(trimmed);
  const username = trimmed.replace(/^@/, "");
  return username ? `https://${host}/${username}` : null;
}

function BrandMark({ name, logoUrl, size = "md" }) {
  const dim = size === "lg" ? "w-14 h-14" : "w-12 h-12";
  const initials = (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name || "Brand logo"}
        className={`${dim} rounded-xl object-contain bg-white border border-outline-variant/15 flex-shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-xl bg-primary/10 text-primary flex items-center justify-center font-headline font-extrabold text-sm flex-shrink-0`}
    >
      {initials || "?"}
    </div>
  );
}

function Profile({ isLoggedIn, user }) {
  const {
    isVerified,
    role,
    loading: verificationLoading,
    refreshRole,
    isVerificationExpired,
    isVerificationExpiringSoon,
    verifiedAt,
  } = useRoleContext();

  // ── Avatar upload ───────────────────────────────────
  const fileInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(
    user?.user_metadata?.avatar_url ||
      user?.user_metadata?.picture ||
      null,
  );
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [avatarError, setAvatarError] = useState("");

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAvatarError("");
    const validationError = validateImageUpload(file);
    if (validationError) {
      setAvatarError(validationError);
      e.target.value = "";
      return;
    }

    setAvatarUploading(true);
    try {
      // A fixed, extension-free path so re-uploading a different format
      // replaces the old object instead of orphaning it.
      const filePath = `${user.id}/avatar`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (updateError) throw updateError;
      // Cache-bust for display only; the stored URL stays clean.
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setAvatarError(err.message || "Couldn't upload that image. Please try again.");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  const [hasPendingVerification, setHasPendingVerification] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const settingsRef = useRef(null);

  const scrollToSettings = () => {
    setTimeout(() => {
      settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // ── User info derivation ────────────────────────────
  const userEmail = getAccountEmail(user);
  const fullName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    userEmail
      .split("@")[0]
      .replace(/[._]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "—";
  const verificationExpiresLabel = formatVerificationExpiry(verifiedAt);

  // ── Profile Editing ───────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: fullName || "",
    email: userEmail || "",
    studentType: user?.user_metadata?.student_type || "university", // 'university' or 'school'
    institution: user?.user_metadata?.institution || "",
    department: user?.user_metadata?.department || "",
    batch: user?.user_metadata?.batch || "",
    grade: user?.user_metadata?.grade || "",
  });
  const [formData, setFormData] = useState({ ...profileData });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // Success banners auto-dismiss; the timers must not outlive the component.
  const successTimersRef = useRef([]);
  useEffect(
    () => () => {
      successTimersRef.current.forEach(clearTimeout);
    },
    [],
  );

  const flashSaved = (setter) => {
    setter(true);
    successTimersRef.current.push(setTimeout(() => setter(false), 2500));
  };

  // Keep the displayed profile in sync with the session's metadata (e.g. after a
  // token refresh), but never overwrite fields the user is actively editing.
  useEffect(() => {
    if (isEditing) return;
    setProfileData({
      fullName: fullName || "",
      email: userEmail || "",
      studentType: user?.user_metadata?.student_type || "university",
      institution: user?.user_metadata?.institution || "",
      department: user?.user_metadata?.department || "",
      batch: user?.user_metadata?.batch || "",
      grade: user?.user_metadata?.grade || "",
    });
  }, [user, fullName, userEmail, isEditing]);

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    setProfileError("");
    setProfileSaved(false);
    setProfileSaving(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: formData.fullName.trim(),
          student_type: formData.studentType,
          institution: formData.institution.trim(),
          department: formData.studentType === 'university' ? formData.department.trim() : "",
          batch: formData.studentType === 'university' ? formData.batch.trim() : "",
          grade: formData.studentType === 'school' ? formData.grade.trim() : "",
        },
      });
      if (error) throw error;
      const meta = data?.user?.user_metadata ?? {};
      setProfileData({
        fullName: meta.full_name ?? formData.fullName,
        email: data?.user?.email ?? profileData.email,
        studentType: meta.student_type ?? formData.studentType,
        institution: meta.institution ?? "",
        department: meta.department ?? "",
        batch: meta.batch ?? "",
        grade: meta.grade ?? "",
      });
      setIsEditing(false);
      flashSaved(setProfileSaved);
    } catch (err) {
      console.error("Failed to update profile:", err);
      setProfileError(err.message || "Failed to save your profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData({ ...profileData });
    setProfileError("");
    setIsEditing(false);
  };

  // ── Partner Specific State ────────────────────────────
  const [managedBrands, setManagedBrands] = useState([]);
  const [activeBrand, setActiveBrand] = useState(null);
  const [activeDealsCount, setActiveDealsCount] = useState(0);
  const [brandFormData, setBrandFormData] = useState({});
  const [isEditingBrand, setIsEditingBrand] = useState(false);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandError, setBrandError] = useState("");
  const [brandSaved, setBrandSaved] = useState(false);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandLogoUploading, setBrandLogoUploading] = useState(false);
  const brandLogoInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function fetchPartnerData() {
      if (!user || (role !== "partner" && role !== "admin")) {
        setManagedBrands([]);
        setActiveBrand(null);
        setBrandFormData({});
        setBrandLoading(false);
        setBrandError("");
        return;
      }

      setBrandLoading(true);
      const { data: accessData, error: accessError } = await supabase
        .from("partner_profiles")
        .select("brand_id, brand_name, brands(*)")
        .eq("user_id", user.id);

      if (!active) return;

      if (accessError) {
        console.error("Failed to load partner brand:", accessError);
        setBrandError("Couldn't load your brand profile. Check your connection and refresh.");
        setManagedBrands([]);
        setActiveBrand(null);
        setBrandLoading(false);
        return;
      }

      const brands = (accessData || [])
        .map(linkedBrandFromProfile)
        .filter((brand) => brand?.id);
      setManagedBrands(brands);
      if (brands.length > 0) {
        setActiveBrand(brands[0]);
        setBrandFormData(brandToForm(brands[0]));
        setBrandError("");
      } else {
        setActiveBrand(null);
        setBrandFormData({});
      }
      setBrandLoading(false);
    }
    fetchPartnerData();
    return () => { active = false; };
  }, [user, role]);

  useEffect(() => {
    let active = true;
    async function fetchActiveDeals() {
      if (!user || !activeBrand?.id) return;
      // Keyed on brand_id like the rest of the app; the denormalized `brand`
      // text goes stale the moment a brand is renamed.
      const { count, error } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', activeBrand.id)
        .in('status', ['active', 'approved']);

      if (!active) return;
      if (error) {
        console.error("Failed to count active deals:", error);
        return;
      }
      setActiveDealsCount(count ?? 0);
    }
    fetchActiveDeals();
    return () => { active = false; };
  }, [user, activeBrand]);

  const handleSaveBrand = async (e) => {
    e.preventDefault();
    if (!activeBrand) return;
    setBrandError("");
    setBrandSaved(false);

    if (!activeBrand.id) {
      setBrandError("This account isn't linked to a brand record yet. Please contact support.");
      return;
    }

    setBrandSaving(true);
    try {
      const { data, error } = await supabase
        .from('brands')
        .update({
          ...brandFormData,
          name: brandFormData.name.trim(),
          category: brandFormData.category.trim() || null,
          description: brandFormData.description.trim() || null,
          website_url: brandFormData.website_url.trim() || null,
          instagram_handle: brandFormData.instagram_handle.trim() || null,
          tiktok_handle: brandFormData.tiktok_handle.trim() || null,
          location: brandFormData.location.trim() || null,
        })
        .eq('id', activeBrand.id)
        .select();
      if (error) throw error;
      // An empty result with no error means row-level security rejected the
      // write, which PostgREST reports as a successful no-op.
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to edit this brand, or it no longer exists.");
      }
      setActiveBrand({ ...activeBrand, ...data[0] });
      setManagedBrands(prev => prev.map(b => b.id === activeBrand.id ? { ...b, ...data[0] } : b));
      setIsEditingBrand(false);
      flashSaved(setBrandSaved);
    } catch (err) {
      console.error("Failed to update brand:", err);
      setBrandError(
        err?.code === "23505" || /duplicate key/i.test(err?.message ?? "")
          ? "That brand name is already taken. Please choose another."
          : err.message || "Failed to save brand profile.",
      );
    } finally {
      setBrandSaving(false);
    }
  };

  const handleBrandLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeBrand?.id) return;

    const validationError = validateImageUpload(file);
    if (validationError) {
      setBrandError(validationError);
      e.target.value = "";
      return;
    }

    setBrandError("");
    setBrandLogoUploading(true);
    try {
      const { publicUrl } = await uploadBrandLogo({
        file,
        brandName: activeBrand.name || brandFormData.name || "brand",
      });
      const { data, error } = await supabase
        .from("brands")
        .update({ logo_url: publicUrl })
        .eq("id", activeBrand.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to update this brand logo.");
      }
      setActiveBrand({ ...activeBrand, ...data[0] });
      setManagedBrands((prev) =>
        prev.map((b) => (b.id === activeBrand.id ? { ...b, ...data[0] } : b)),
      );
      flashSaved(setBrandSaved);
    } catch (err) {
      console.error("Failed to upload brand logo:", err);
      setBrandError(err.message || "Couldn't upload that logo. Please try again.");
    } finally {
      setBrandLogoUploading(false);
      e.target.value = "";
    }
  };

  // ── Notification Preferences ────────────────────────
  const [prefDealAlerts, setPrefDealAlerts] = useState(user?.user_metadata?.pref_deal_alerts ?? true);
  const [prefEventReminders, setPrefEventReminders] = useState(user?.user_metadata?.pref_event_reminders ?? true);
  const [prefSaving, setPrefSaving] = useState(false);

  const togglePreference = async (key, currentValue, setter) => {
    const newValue = !currentValue;
    setter(newValue); // Optimistic UI update
    setPrefSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { [key]: newValue }
      });
      if (error) throw error;
    } catch (err) {
      console.error("Failed to update preference:", err);
      setter(currentValue); // Revert on failure
    } finally {
      setPrefSaving(false);
    }
  };

  // ── Settings form state ─────────────────────────────
  const [settingsPassword, setSettingsPassword] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    setSettingsError("");

    if (settingsPassword) {
      const strengthError = validatePasswordStrength(settingsPassword);
      if (strengthError) {
        setSettingsError(strengthError);
        return;
      }
    }

    setSettingsSaving(true);
    try {
      const updates = {};
      if (settingsPassword) {
        updates.password = settingsPassword;
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.auth.updateUser(updates);
        if (error) throw error;
      }
      setSettingsPassword("");
      flashSaved(setSettingsSaved);
    } catch (err) {
      setSettingsError(err.message || "Failed to save settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  if (!isLoggedIn) return <Navigate to="/" replace />;

  const hasLinkedBrand = role === "partner" && Boolean(activeBrand?.id);

  // Without this, partners and admins briefly render the student card while
  // the role / brand assignment resolves.
  if (verificationLoading || (role === "partner" && brandLoading)) {
    return (
      <div className="max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 md:py-12">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
            <div className="h-24 w-24 rounded-full skeleton-shimmer mx-auto lg:mx-0" />
            <div className="h-40 w-full rounded-2xl skeleton-shimmer" />
          </div>
          <div className="flex-1 w-full space-y-6">
            <div className="h-56 w-full rounded-2xl skeleton-shimmer" />
            <div className="h-40 w-full rounded-2xl skeleton-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 md:py-12 animate-fade-in">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
        {/* Left Column (Identity & ID Card) */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col items-center lg:items-start">
          {/* Header section */}
          <div className="flex flex-col items-center text-center space-y-4">
        <div className="relative avatar-upload-container group">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center relative shadow-lg border-4 border-surface">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="w-24 h-24 rounded-full object-cover shadow-sm" />
            ) : (
              <span className="material-symbols-outlined text-5xl text-on-surface-variant">person</span>
            )}
            <div className="avatar-upload-overlay rounded-full" onClick={() => fileInputRef.current?.click()}>
              {avatarUploading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
              )}
            </div>
          </div>
        </div>

        {avatarError && (
          <p className="text-error text-xs font-bold bg-error/10 p-2.5 rounded-lg max-w-[16rem]">
            {avatarError}
          </p>
        )}

        <div>
          <h1 className="font-headline font-extrabold text-2xl tracking-tighter text-on-background">
            {hasLinkedBrand
              ? (activeBrand.name || profileData.fullName?.split(" ")[0] || "Partner")
              : (profileData.fullName?.split(" ")[0] || "Student")}
          </h1>
          {userEmail ? (
            <p className="mt-1 text-xs text-on-surface-variant font-medium truncate max-w-[16rem]">
              {userEmail}
            </p>
          ) : null}
          <div className="mt-1 flex items-center justify-center">
            {isVerified || role === "admin" || hasLinkedBrand ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                {role === "admin" ? "Verified Admin" : hasLinkedBrand ? "Verified Brand" : "Verified Student"}
              </span>
            ) : isVerificationExpired ? (
              <button onClick={() => { setVerificationOpen(true); scrollToSettings(); }} className="inline-flex items-center gap-1 text-xs font-bold text-[#d4a017] bg-[#d4a017]/10 px-2.5 py-1 rounded-full hover:bg-[#d4a017]/20 transition-colors min-h-[44px]">
                <span className="material-symbols-outlined text-[14px]">event_busy</span>
                Verification expired
              </button>
            ) : hasPendingVerification ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#d4a017] bg-[#d4a017]/10 px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[14px]">pending</span>
                Verification Pending
              </span>
            ) : (
              <button onClick={() => { setVerificationOpen(true); scrollToSettings(); }} className="inline-flex items-center gap-1 text-xs font-bold text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full hover:bg-surface-container-high transition-colors min-h-[44px]">
                <span className="material-symbols-outlined text-[14px]">info</span>
                Unverified
              </button>
            )}
          </div>
        </div>
      </div>

      {role === 'admin' ? (
        <div className="mt-8 id-card-glass rounded-2xl p-5 md:p-6 w-full max-w-sm mx-auto lg:mx-0 shadow-xl border border-outline-variant/20 flex flex-col gap-5">
          <h3 className="font-headline font-bold text-base text-on-background border-b border-outline-variant/20 pb-2">Platform Status</h3>
          <div className="space-y-4">
            <div>
              <p className="text-on-surface-variant/70 font-bold uppercase tracking-wider text-xs mb-1">Status</p>
              <div className="flex items-center gap-2 text-primary font-bold text-sm bg-primary/10 px-3 py-1.5 rounded-lg w-fit">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                Active Admin
              </div>
            </div>
            <div>
              <p className="text-on-surface-variant/70 font-bold uppercase tracking-wider text-xs mb-1">System Status</p>
              <p className="font-headline font-bold text-on-background flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                Online
              </p>
            </div>
          </div>
        </div>
      ) : hasLinkedBrand ? (
        <div className="mt-8 id-card-glass rounded-2xl p-5 md:p-6 w-full max-w-sm mx-auto lg:mx-0 shadow-xl border border-outline-variant/20 flex flex-col gap-5">
          <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">Brand Pass</p>
          <div className="flex items-center gap-4 w-full">
            <BrandMark name={activeBrand.name} logoUrl={activeBrand.logo_url} size="lg" />
            <div className="min-w-0">
              <p className="font-headline font-bold text-sm text-on-background truncate">
                {activeBrand.name}
              </p>
              <p className="text-xs text-on-surface-variant/70 truncate">
                {activeBrand.category || "Partner account"}
              </p>
              <p className="text-xs text-on-surface-variant truncate">
                {userEmail || "Email not available"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs w-full pt-1">
            <div>
              <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">Joined</p>
              <p className="font-headline font-bold text-on-background">{memberSince}</p>
            </div>
            <div>
              <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">Live deals</p>
              <p className="font-headline font-bold text-on-background">{activeDealsCount}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 id-card-glass rounded-2xl p-5 md:p-6 flex flex-col items-center gap-5 w-full max-w-sm mx-auto lg:mx-0 shadow-xl">
          <div className="flex items-center justify-between w-full">
            <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">Student Pass</p>
            <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">
              {isVerified ? "Active" : isVerificationExpired ? "Expired" : "Inactive"}
            </span>
          </div>
          <div className="flex items-center gap-4 flex-1 w-full">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface-container">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-surface-variant">person</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-headline font-bold text-sm text-on-background truncate">
                {profileData.fullName || "Student"}
              </p>
              <p className="text-xs text-on-surface-variant/70 truncate">
                {userEmail || "Email not available"}
              </p>
              <p className="text-xs text-on-surface-variant/60 truncate">
                {profileData.studentType === 'school' ? 'High School ID' : 'University ID'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs w-full">
            <div>
              <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">
                {profileData.studentType === 'school' ? 'School' : 'University'}
              </p>
              <p className="font-headline font-bold text-on-background truncate">
                {profileData.institution || "—"}
              </p>
            </div>
            <div>
              <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">
                {profileData.studentType === 'school' ? 'Grade / Level' : 'Batch / Intake'}
              </p>
              <p className="font-headline font-bold text-on-background truncate">
                {profileData.studentType === 'school' ? (profileData.grade || "—") : (profileData.batch || "—")}
              </p>
            </div>
            {profileData.studentType !== 'school' ? (
              <div className="col-span-2">
                <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">
                  Faculty
                </p>
                <p className="font-headline font-bold text-on-background truncate">
                  {profileData.department || "—"}
                </p>
              </div>
            ) : null}
          </div>

          {isVerified && user?.id ? (
            <div className="w-full flex flex-col items-center gap-2 pt-4 border-t border-outline-variant/20">
              <div className="bg-white p-2.5 rounded-xl">
                <QRCodeSVG value={`unideals://student/${user.id}`} size={140} />
              </div>
              <p className="text-[11px] text-on-surface-variant/70 text-center leading-relaxed">
                {verificationExpiresLabel
                  ? `Valid until ${verificationExpiresLabel} · in-store tickets still come from each deal page`
                  : "Student Pass · in-store tickets still come from each deal page"}
              </p>
            </div>
          ) : (
            <div className="w-full flex items-center gap-2 pt-4 border-t border-outline-variant/20 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-base">lock</span>
              {isVerificationExpired
                ? "Re-verify for this year to activate your pass"
                : "Verify your student status to activate your pass"}
            </div>
          )}
        </div>
      )}

        </div>

        {/* Right Column (Settings & Security) */}
        <div className="flex-1 w-full flex flex-col gap-6" ref={settingsRef}>
        
        {/* Dynamic Right Column Profile Card */}
        {role === 'admin' ? (
          <div className="w-full bg-gray-50 rounded-2xl p-6 shadow-sm border border-outline-variant/20 relative">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline font-bold text-base text-on-background">Administrative Account</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Full Name</p>
                <p className="text-sm font-medium text-on-background">{profileData.fullName || "Admin User"}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Contact Email</p>
                <p className="text-sm font-medium text-on-background">{userEmail || "Not available"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Access Level</p>
                <p className="text-sm font-medium text-primary">Super Admin</p>
              </div>
            </div>
          </div>
        ) : hasLinkedBrand ? (
          <div className="w-full bg-surface rounded-2xl p-6 shadow-sm border border-outline-variant/20 relative">
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
              <h3 className="font-headline font-bold text-base text-on-background">Brand Profile</h3>
              <div className="flex items-center gap-3">
                {managedBrands.length > 1 && (
                  <select 
                    className="bg-surface text-sm font-bold border border-outline-variant/30 rounded-lg px-2 py-1 text-on-surface-variant focus:outline-none"
                    value={activeBrand.id}
                    onChange={(e) => {
                      const newBrand = managedBrands.find(b => b.id === e.target.value);
                      if (newBrand) {
                        setActiveBrand(newBrand);
                        setBrandFormData(brandToForm(newBrand));
                        setIsEditingBrand(false);
                      }
                    }}
                  >
                    {managedBrands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
                {!isEditingBrand && (
                  <button 
                    onClick={() => {
                      setBrandFormData(brandToForm(activeBrand));
                      setBrandError("");
                      setIsEditingBrand(true);
                    }} 
                    className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            {isEditingBrand ? (
              <form onSubmit={handleSaveBrand} className="space-y-5 animate-fade-in">
                <div className="flex items-center gap-4">
                  <BrandMark name={brandFormData.name || activeBrand.name} logoUrl={activeBrand.logo_url} size="lg" />
                  <div>
                    <button
                      type="button"
                      onClick={() => brandLogoInputRef.current?.click()}
                      disabled={brandLogoUploading}
                      className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {brandLogoUploading ? "Uploading..." : "Change logo"}
                    </button>
                    <p className="text-[11px] text-on-surface-variant/70 mt-1.5">JPEG, PNG, or WEBP. 5MB max.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Brand Name</label>
                    <input type="text" value={brandFormData.name} onChange={(e) => setBrandFormData({...brandFormData, name: e.target.value})} className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Contact Email</label>
                    <input type="email" value={userEmail} readOnly className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 w-full text-sm text-on-surface-variant cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      value={brandFormData.category}
                      onChange={(e) => setBrandFormData({...brandFormData, category: e.target.value})}
                      className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background"
                    >
                      <option value="">Select a category</option>
                      {[
                        ...OFFICIAL_CATEGORIES,
                        ...(brandFormData.category && !OFFICIAL_CATEGORIES.includes(brandFormData.category)
                          ? [brandFormData.category]
                          : []),
                      ].map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Location</label>
                    <input type="text" value={brandFormData.location} onChange={(e) => setBrandFormData({...brandFormData, location: e.target.value})} placeholder="e.g. Colombo" className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Description</label>
                    <textarea value={brandFormData.description} onChange={(e) => setBrandFormData({...brandFormData, description: e.target.value})} className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background min-h-[80px]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Website URL</label>
                    <input type="url" value={brandFormData.website_url} onChange={(e) => setBrandFormData({...brandFormData, website_url: e.target.value})} placeholder="https://" className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Instagram Handle</label>
                    <input type="text" value={brandFormData.instagram_handle} onChange={(e) => setBrandFormData({...brandFormData, instagram_handle: e.target.value})} placeholder="@username" className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">TikTok Handle</label>
                    <input type="text" value={brandFormData.tiktok_handle} onChange={(e) => setBrandFormData({...brandFormData, tiktok_handle: e.target.value})} placeholder="@username" className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button type="submit" disabled={brandSaving} className="px-6 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50">
                    {brandSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => { setIsEditingBrand(false); setBrandError(""); setBrandFormData(brandToForm(activeBrand)); }} className="text-sm font-bold text-on-surface-variant hover:text-on-background transition-colors">
                    Cancel
                  </button>
                </div>

                {brandError && <p className="text-error text-xs font-bold bg-error/10 p-2.5 rounded-lg">{brandError}</p>}
              </form>
            ) : (
              <div className="space-y-5 animate-fade-in">
                {brandSaved && (
                  <div className="flex items-center gap-2 text-primary bg-primary/10 p-2.5 rounded-lg">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <p className="text-xs font-bold">Brand profile updated successfully.</p>
                  </div>
                )}
                {brandError && <p className="text-error text-xs font-bold bg-error/10 p-2.5 rounded-lg">{brandError}</p>}
                <div className="flex items-center gap-4 pb-2 border-b border-outline-variant/15">
                  <BrandMark name={activeBrand.name} logoUrl={activeBrand.logo_url} size="lg" />
                  <div className="min-w-0">
                    <p className="font-headline font-bold text-on-background truncate">{activeBrand.name || "Unnamed brand"}</p>
                    <p className="text-sm text-on-surface-variant truncate">{userEmail || "Email not available"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Brand Name</p>
                    <p className="text-sm font-medium text-on-background">{activeBrand.name || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Contact Email</p>
                    <p className="text-sm font-medium text-on-background break-all">{userEmail || "Not available"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Category</p>
                    <p className="text-sm font-medium text-on-background">{activeBrand.category || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Location</p>
                    <p className="text-sm font-medium text-on-background">{activeBrand.location || "Not provided"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Description</p>
                    <p className="text-sm font-medium text-on-background whitespace-pre-wrap">{activeBrand.description || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Website</p>
                    {asHttpUrl(activeBrand.website_url) ? (
                      <a href={asHttpUrl(activeBrand.website_url)} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline break-all">
                        {activeBrand.website_url}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-on-background">Not provided</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Instagram</p>
                    {socialHref(activeBrand.instagram_handle, "instagram.com") ? (
                      <a href={socialHref(activeBrand.instagram_handle, "instagram.com")} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                        {activeBrand.instagram_handle}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-on-background">Not provided</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">TikTok</p>
                    {socialHref(activeBrand.tiktok_handle, "tiktok.com") ? (
                      <a href={socialHref(activeBrand.tiktok_handle, "tiktok.com")} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                        {activeBrand.tiktok_handle}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-on-background">Not provided</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full bg-gray-50 rounded-2xl p-6 shadow-sm border border-outline-variant/20 relative">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline font-bold text-base text-on-background">Personal & Academic Details</h3>
              {!isEditing && (
                <button 
                  onClick={() => { setFormData({ ...profileData }); setProfileError(""); setIsEditing(true); }} 
                  className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit Profile
                </button>
              )}
            </div>
            
            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-5 animate-fade-in">
                {/* Student Type Toggle */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Student Type</label>
                  <div className="flex gap-2 p-1 bg-surface-container-low rounded-xl border border-outline-variant/20">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, studentType: 'school' })}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${formData.studentType === 'school' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-background'}`}
                    >
                      High School
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, studentType: 'university' })}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${formData.studentType === 'university' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-background'}`}
                    >
                      University / College
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Full Name</label>
                    <input type="text" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Email</label>
                    <input type="email" value={userEmail} readOnly className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full text-sm text-on-surface-variant cursor-not-allowed" />
                  </div>
                  
                  {formData.studentType === 'university' ? (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">University Name</label>
                        <input type="text" value={formData.institution} onChange={(e) => setFormData({...formData, institution: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" required />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Faculty / Department</label>
                        <input type="text" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" required />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Batch / Intake</label>
                        <input type="text" value={formData.batch} onChange={(e) => setFormData({...formData, batch: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" required />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">School Name</label>
                        <input type="text" value={formData.institution} onChange={(e) => setFormData({...formData, institution: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" required />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Current Grade / Year</label>
                        <input type="text" value={formData.grade} onChange={(e) => setFormData({...formData, grade: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" required />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button type="submit" disabled={profileSaving} className="px-6 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                    {profileSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={handleCancelEdit} className="text-sm font-bold text-on-surface-variant hover:text-on-background transition-colors">
                    Cancel
                  </button>
                </div>

                {profileError && <p className="text-error text-xs font-bold bg-error/10 p-2.5 rounded-lg">{profileError}</p>}
              </form>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {profileSaved && (
                  <div className="flex items-center gap-2 text-primary bg-primary/10 p-2.5 rounded-lg">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <p className="text-xs font-bold">Profile updated successfully.</p>
                  </div>
                )}
                {profileError && <p className="text-error text-xs font-bold bg-error/10 p-2.5 rounded-lg">{profileError}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Full Name</p>
                    <p className="text-sm font-medium text-on-background">{profileData.fullName || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Email</p>
                    <p className="text-sm font-medium text-on-background break-all">{userEmail || "Not available"}</p>
                  </div>
                  
                  {profileData.studentType === 'university' ? (
                    <>
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">University</p>
                        <p className="text-sm font-medium text-on-background">{profileData.institution || "Not provided"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Faculty / Department</p>
                        <p className="text-sm font-medium text-on-background">{profileData.department || "Not provided"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Batch / Intake</p>
                        <p className="text-sm font-medium text-on-background">{profileData.batch || "Not provided"}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">School</p>
                        <p className="text-sm font-medium text-on-background">{profileData.institution || "Not provided"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Grade / Year Level</p>
                        <p className="text-sm font-medium text-on-background">{profileData.grade || "Not provided"}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Desktop Grid for Settings */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
          {/* Notification Preferences Card */}
          <div className="w-full bg-gray-50 rounded-2xl p-6 shadow-sm border border-outline-variant/20">
            <h3 className="font-headline font-bold text-base text-on-background mb-4">Notification Preferences</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <p className="text-sm font-bold text-on-background">
                    {role === 'admin' ? 'New Partner Signups' : hasLinkedBrand ? 'Daily Redemption Summaries' : 'New Deal Alerts'}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {role === 'admin' ? 'Get notified when a new brand registers.' : hasLinkedBrand ? 'Get a daily summary of all redemptions.' : 'Get notified when new exclusive deals drop.'}
                  </p>
                </div>
                <div className="relative ml-4">
                  <input type="checkbox" className="sr-only peer" checked={prefDealAlerts} onChange={() => togglePreference('pref_deal_alerts', prefDealAlerts, setPrefDealAlerts)} disabled={prefSaving} />
                  <div className={`w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary group-hover:opacity-80 transition-opacity ${prefSaving ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                </div>
              </label>
              
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <p className="text-sm font-bold text-on-background">
                    {role === 'admin' ? 'Pending Verifications' : hasLinkedBrand ? 'Deal Expiry Warnings' : 'Campus Event Reminders'}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {role === 'admin' ? 'Alerts for unverified student IDs.' : hasLinkedBrand ? 'Receive warnings before your active deals expire.' : 'Receive reminders for upcoming events.'}
                  </p>
                </div>
                <div className="relative ml-4">
                  <input type="checkbox" className="sr-only peer" checked={prefEventReminders} onChange={() => togglePreference('pref_event_reminders', prefEventReminders, setPrefEventReminders)} disabled={prefSaving} />
                  <div className={`w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary group-hover:opacity-80 transition-opacity ${prefSaving ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                </div>
              </label>
            </div>
          </div>

          {/* Preferences / Account Security Card */}
          <div className="w-full bg-gray-50 rounded-2xl p-6 shadow-sm border border-outline-variant/20">
            <h3 className="font-headline font-bold text-base text-on-background mb-4">Account Security</h3>
            <form onSubmit={handleSettingsSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Change Password</label>
                <input type="password" autoComplete="new-password" placeholder="Leave blank to keep current" value={settingsPassword} onChange={(e) => setSettingsPassword(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[44px] text-sm text-on-background focus:outline-none focus:border-primary transition-all" />
                <p className="text-[11px] text-on-surface-variant/70 mt-1.5">{PASSWORD_HINT}</p>
              </div>
              <button type="submit" disabled={settingsSaving} className="min-h-[44px] px-6 py-3 bg-primary/10 text-primary hover:bg-primary/20 font-bold text-sm rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                {settingsSaving ? "Saving..." : "Update Password"}
              </button>
              {settingsError && <p className="text-error text-xs font-bold bg-error/10 p-2.5 rounded-lg">{settingsError}</p>}
              {settingsSaved && (
                <div className="flex items-center gap-2 text-primary bg-primary/10 p-2.5 rounded-lg">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <p className="text-xs font-bold">Settings updated successfully.</p>
                </div>
              )}
            </form>
          </div>
        </div>

        {role !== "admin" && !hasLinkedBrand && (!isVerified || isVerificationExpiringSoon) && (
          <StudentVerificationCard
            user={user}
            isSchoolStudent={user?.user_metadata?.student_type === "school"}
            onInFlightChange={setHasPendingVerification}
            formOpen={verificationOpen}
            onFormOpenChange={setVerificationOpen}
            onSubmitted={refreshRole}
            renewal={isVerificationExpired || isVerificationExpiringSoon}
            expiresOn={verificationExpiresLabel}
          />
        )}

        </div>
      </div>
      
      {/* Hidden file input for avatar */}
      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleAvatarUpload} />
      <input type="file" accept="image/jpeg,image/png,image/webp" ref={brandLogoInputRef} className="hidden" onChange={handleBrandLogoUpload} />
    </div>
  );
}

export default Profile;
