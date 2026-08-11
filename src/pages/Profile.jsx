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

function Profile({ isLoggedIn, user }) {
  const {
    isVerified,
    role,
    loading: verificationLoading,
    refreshRole,
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

      if (!active || error) return;
      // Must be able to clear, otherwise a rejected student stays locked in
      // the "pending" state and can never resubmit.
      setHasPendingVerification(data.length > 0);
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
      // The code is generated and emailed by the edge function; it is never
      // returned to the browser.
      const { data, error } = await supabase.functions.invoke(
        "send-verification-otp",
        { body: { email: normalized } },
      );

      if (data?.success) {
        setVerificationStep(2);
        setResendCooldown(60);
        return;
      }

      // Non-2xx responses surface as an error with the raw Response attached,
      // so the specific reason (rate limited, domain rejected) isn't lost.
      let reason = data?.error;
      if (!reason && error?.context?.json) {
        reason = (await error.context.json().catch(() => null))?.error;
      }
      setUniError(reason || "Failed to send the verification code.");
    } catch (err) {
      console.error("Verification request failed:", err);
      setUniError("Couldn't send the verification code. Please try again.");
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

    const validationError = validateImageUpload(manualFile);
    if (validationError) {
      setManualError(validationError);
      return;
    }

    if (manualVerifying) return;
    setManualVerifying(true);
    
    try {
      // 1. Upload to a user-scoped folder in the private documents bucket
      const fileExt = manualFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('verification-documents')
        .upload(filePath, manualFile, { contentType: manualFile.type });

      if (uploadError) throw uploadError;

      // 2. Store the object path. The bucket is private, so admins mint a
      //    short-lived signed URL at review time instead.
      const { data, error } = await supabase.rpc("submit_manual_verification", {
        inst_type: manualInstType,
        inst_name: manualInstName.trim(),
        course: manualCourse.trim(),
        student_id: manualStudentId.trim(),
        email: user?.email || "unknown@example.com",
        image_url: filePath
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

  useEffect(() => {
    let active = true;
    async function fetchPartnerData() {
      if (!user || (role !== 'partner' && role !== 'admin')) return;
      
      const { data: accessData, error: accessError } = await supabase
        .from('partner_profiles')
        .select('brand_id, brand_name, brands(*)')
        .eq('user_id', user.id);

      if (!active) return;

      if (accessError) {
        console.error("Failed to load partner brand:", accessError);
        setBrandError("Couldn't load your brand profile. Check your connection and refresh.");
        return;
      }

      if (accessData && accessData.length > 0) {
        const brands = accessData.map(a => {
          if (a.brands) return a.brands;
          return {
            id: a.brand_id || null,
            name: a.brand_name || "",
            category: "",
            description: "",
            website_url: "",
            instagram_handle: "",
            tiktok_handle: ""
          };
        });
        setManagedBrands(brands);
        if (brands.length > 0) {
          setActiveBrand(brands[0]);
          setBrandFormData({
            name: brands[0].name || "",
            category: brands[0].category || "",
            description: brands[0].description || "",
            website_url: brands[0].website_url || "",
            instagram_handle: brands[0].instagram_handle || "",
            tiktok_handle: brands[0].tiktok_handle || "",
            location: brands[0].location || ""
          });
        }
      }
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
        .update(brandFormData)
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

  // Without this, partners and admins briefly render the student card while
  // the role resolves.
  if (verificationLoading) {
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
            {profileData.fullName?.split(' ')[0] || "Student"}
          </h1>
          <div className="mt-1 flex items-center justify-center">
            {isVerified || role === "admin" || role === "partner" ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                {role === "admin" ? "Verified Admin" : role === "partner" ? "Verified Brand" : "Verified Student"}
              </span>
            ) : hasPendingVerification ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#d4a017] bg-[#d4a017]/10 px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[14px]">pending</span>
                Verification Pending
              </span>
            ) : (
              <button onClick={() => scrollToSettings()} className="inline-flex items-center gap-1 text-xs font-bold text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full hover:bg-surface-container-high transition-colors min-h-[44px]">
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
      ) : role === 'partner' ? (
        <div className="mt-8 id-card-glass rounded-2xl p-5 md:p-6 w-full max-w-sm mx-auto lg:mx-0 shadow-xl border border-outline-variant/20 flex flex-col gap-5">
          <h3 className="font-headline font-bold text-base text-on-background border-b border-outline-variant/20 pb-2">Platform Status</h3>
          <div className="space-y-4">
            <div>
              <p className="text-on-surface-variant/70 font-bold uppercase tracking-wider text-xs mb-1">Status</p>
              <div className="flex items-center gap-2 text-primary font-bold text-sm bg-primary/10 px-3 py-1.5 rounded-lg w-fit">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                Active Partner
              </div>
            </div>
            <div>
              <p className="text-on-surface-variant/70 font-bold uppercase tracking-wider text-xs mb-1">Joined Date</p>
              <p className="font-headline font-bold text-on-background">{memberSince}</p>
            </div>
            <div>
              <p className="text-on-surface-variant/70 font-bold uppercase tracking-wider text-xs mb-1">Active Deals</p>
              <p className="font-headline font-bold text-3xl text-primary">{activeDealsCount}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 id-card-glass rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center lg:items-start xl:items-center gap-5 w-full max-w-sm mx-auto lg:mx-0 shadow-xl">
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
                {profileData.fullName}
              </p>
              <p className="text-xs text-on-surface-variant/60 truncate">
                {profileData.studentType === 'school' ? 'High School ID' : 'University ID'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-4 sm:gap-2 text-xs w-full sm:w-auto">
            <div>
              <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">
                {profileData.studentType === 'school' ? 'Grade / Level' : 'Batch / Intake'}
              </p>
              <p className="font-headline font-bold text-on-background max-w-[120px] truncate">
                {profileData.studentType === 'school' ? (profileData.grade || "—") : (profileData.batch || "—")}
              </p>
            </div>
            <div>
              <p className="text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">
                {profileData.studentType === 'school' ? 'School' : 'Faculty'}
              </p>
              <p className="font-headline font-bold text-on-background max-w-[120px] truncate">
                {profileData.studentType === 'school' ? (profileData.institution || "—") : (profileData.department || "—")}
              </p>
            </div>
          </div>
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
                <p className="text-sm font-medium text-on-background">{user?.email || "Not available"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Access Level</p>
                <p className="text-sm font-medium text-primary">Super Admin</p>
              </div>
            </div>
          </div>
        ) : role === 'partner' && !activeBrand ? (
          <div className="w-full bg-gray-50 rounded-2xl p-6 shadow-sm border border-outline-variant/20">
            <h3 className="font-headline font-bold text-base text-on-background mb-2">Brand Profile</h3>
            <p className="text-on-surface-variant text-sm">
              {brandError ||
                "This partner account isn't linked to a brand yet. Please contact support so we can connect it."}
            </p>
          </div>
        ) : role === 'partner' ? (
          <div className="w-full bg-gray-50 rounded-2xl p-6 shadow-sm border border-outline-variant/20 relative">
            <div className="flex items-center justify-between mb-6">
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
                        setBrandFormData({
                          name: newBrand.name || "",
                          category: newBrand.category || "",
                          description: newBrand.description || "",
                          website_url: newBrand.website_url || "",
                          instagram_handle: newBrand.instagram_handle || "",
                          tiktok_handle: newBrand.tiktok_handle || "",
                          location: newBrand.location || ""
                        });
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
                      setBrandFormData({
                        name: activeBrand.name || "",
                        category: activeBrand.category || "",
                        description: activeBrand.description || "",
                        website_url: activeBrand.website_url || "",
                        instagram_handle: activeBrand.instagram_handle || "",
                        tiktok_handle: activeBrand.tiktok_handle || "",
                        location: activeBrand.location || ""
                      });
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Brand Name</label>
                    <input type="text" value={brandFormData.name} onChange={(e) => setBrandFormData({...brandFormData, name: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Category</label>
                    <input type="text" value={brandFormData.category} onChange={(e) => setBrandFormData({...brandFormData, category: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Description</label>
                    <textarea value={brandFormData.description} onChange={(e) => setBrandFormData({...brandFormData, description: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background min-h-[80px]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Website URL</label>
                    <input type="url" value={brandFormData.website_url} onChange={(e) => setBrandFormData({...brandFormData, website_url: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Instagram Handle</label>
                    <input type="text" value={brandFormData.instagram_handle} onChange={(e) => setBrandFormData({...brandFormData, instagram_handle: e.target.value})} placeholder="@username" className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Location</label>
                    <input type="text" value={brandFormData.location} onChange={(e) => setBrandFormData({...brandFormData, location: e.target.value})} placeholder="e.g. Sydney, NSW" className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm text-on-background" />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button type="submit" disabled={brandSaving} className="px-6 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50">
                    {brandSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => { setIsEditingBrand(false); setBrandError(""); }} className="text-sm font-bold text-on-surface-variant hover:text-on-background transition-colors">
                    Cancel
                  </button>
                </div>

                {brandError && <p className="text-error text-xs font-bold bg-error/10 p-2.5 rounded-lg">{brandError}</p>}
              </form>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {brandSaved && (
                  <div className="flex items-center gap-2 text-primary bg-primary/10 p-2.5 rounded-lg">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <p className="text-xs font-bold">Brand profile updated successfully.</p>
                  </div>
                )}
                {brandError && <p className="text-error text-xs font-bold bg-error/10 p-2.5 rounded-lg">{brandError}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Brand Name</p>
                    <p className="text-sm font-medium text-on-background">{activeBrand.name || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Category</p>
                    <p className="text-sm font-medium text-on-background">{activeBrand.category || "Not provided"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Description</p>
                    <p className="text-sm font-medium text-on-background">{activeBrand.description || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Website URL</p>
                    <p className="text-sm font-medium text-primary hover:underline">{activeBrand.website_url ? <a href={activeBrand.website_url} target="_blank" rel="noreferrer">{activeBrand.website_url}</a> : "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Instagram</p>
                    <p className="text-sm font-medium text-on-background">{activeBrand.instagram_handle || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Location</p>
                    <p className="text-sm font-medium text-on-background">{activeBrand.location || "Not provided"}</p>
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
                    <p className="text-sm font-medium text-on-background">{profileData.email || "Not provided"}</p>
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
                    {role === 'admin' ? 'New Partner Signups' : role === 'partner' ? 'Daily Redemption Summaries' : 'New Deal Alerts'}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {role === 'admin' ? 'Get notified when a new brand registers.' : role === 'partner' ? 'Get a daily summary of all redemptions.' : 'Get notified when new exclusive deals drop.'}
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
                    {role === 'admin' ? 'Pending Verifications' : role === 'partner' ? 'Deal Expiry Warnings' : 'Campus Event Reminders'}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {role === 'admin' ? 'Alerts for unverified student IDs.' : role === 'partner' ? 'Receive warnings before your active deals expire.' : 'Receive reminders for upcoming events.'}
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

        {/* University Email Verification Card */}
        {role === "student" && !isVerified && (
          <div className="w-full bg-gray-50 rounded-2xl p-6 shadow-sm border border-outline-variant/20">
            <div className="flex items-start gap-3 mb-4">
              <span className="material-symbols-outlined text-primary text-2xl mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
              <div>
                <h3 className="font-headline font-bold text-base text-on-background">Verify Your Student Status</h3>
                <p className="text-on-surface-variant text-sm mt-1">Add your university email to unlock all deal codes and in-store perks.</p>
              </div>
            </div>
            
            {verificationStep === 1 ? (
              <form onSubmit={handleRequestVerification} className="flex flex-col sm:flex-row gap-3">
                <input type="email" placeholder="you@university.edu" value={uniEmail} onChange={(e) => setUniEmail(e.target.value)} required disabled={uniVerifying} className="flex-1 bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[44px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                <button type="submit" disabled={uniVerifying || !uniEmail} className="min-h-[44px] px-6 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                  {uniVerifying ? "Sending..." : "Send Code"}
                </button>
              </form>
            ) : uniSuccess ? (
              <div className="flex items-center gap-3 p-4 bg-primary/10 text-primary rounded-xl">
                <span className="material-symbols-outlined">check_circle</span>
                <p className="text-sm font-bold">Verification successful! You now have full access.</p>
              </div>
            ) : (
              <form onSubmit={handleConfirmVerification} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input type="text" placeholder="6-digit code" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} maxLength={6} required disabled={uniVerifying} className="flex-1 bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[44px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all tracking-widest font-mono" />
                  <button type="submit" disabled={uniVerifying || otpCode.length !== 6} className="min-h-[44px] px-6 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                    {uniVerifying ? "Verifying..." : "Verify Code"}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-on-surface-variant">Didn't receive it?</span>
                  <button type="button" onClick={handleResendOtp} disabled={resendCooldown > 0} className="text-primary font-bold hover:underline disabled:opacity-50 disabled:no-underline min-h-[44px]">
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                  </button>
                </div>
              </form>
            )}
            {uniError && <p className="text-error text-xs font-bold mt-3 bg-error/10 p-2.5 rounded-lg">{uniError}</p>}
          </div>
        )}

        {/* Manual Verification Card */}
        {role === "student" && !isVerified && (
          <div className="w-full bg-gray-50 rounded-2xl p-6 shadow-sm border border-outline-variant/20">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-headline font-bold text-base text-on-background">Manual Verification</h3>
                <p className="text-on-surface-variant text-sm mt-1">If your university email is not supported, upload your student ID.</p>
              </div>
              <button onClick={() => setShowManualVerification(!showManualVerification)} className="min-h-[44px] px-4 py-2 bg-surface text-on-surface-variant font-bold text-xs rounded-xl border border-outline-variant/20 hover:bg-surface-container transition-all active:scale-[0.98] whitespace-nowrap">
                {showManualVerification ? "Cancel" : "Start Manual"}
              </button>
            </div>
            
            {showManualVerification && (
              <div className="mt-6 pt-6 border-t border-outline-variant/10 animate-fade-in">
                {manualSuccess || hasPendingVerification ? (
                  <div className="flex items-center gap-3 p-4 bg-[#d4a017]/10 text-[#d4a017] rounded-xl">
                    <span className="material-symbols-outlined">pending_actions</span>
                    <p className="text-sm font-bold">Verification request is pending review. This usually takes 24-48 hours.</p>
                  </div>
                ) : (
                  <form onSubmit={handleManualVerify} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Institution Type</label>
                      <select value={manualInstType} onChange={(e) => setManualInstType(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[44px] text-sm text-on-background focus:outline-none focus:border-primary transition-all">
                        <option value="university">University / College</option>
                        <option value="professional">Professional Body (e.g. CIMA, ACCA)</option>
                        <option value="other">Other Educational Institution</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Institution Name</label>
                      <input type="text" required placeholder="e.g. University of Colombo" value={manualInstName} onChange={(e) => setManualInstName(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[44px] text-sm text-on-background focus:outline-none focus:border-primary transition-all" />
                    </div>
                    
                    {manualInstType === "university" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Course/Program</label>
                          <input type="text" required placeholder="e.g. BSc Computer Science" value={manualCourse} onChange={(e) => setManualCourse(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[44px] text-sm text-on-background focus:outline-none focus:border-primary transition-all" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Student ID Number</label>
                          <input type="text" required placeholder="e.g. IT21000000" value={manualStudentId} onChange={(e) => setManualStudentId(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[44px] text-sm text-on-background focus:outline-none focus:border-primary transition-all" />
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Upload Proof (ID Card or Letter)</label>
                      <div className="relative min-h-[44px]">
                        <input type="file" accept="image/jpeg, image/png, image/webp" onChange={(e) => setManualFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" required />
                        <div className="w-full bg-surface border-2 border-dashed border-outline-variant/30 rounded-xl px-4 py-6 text-center focus-within:border-primary hover:bg-surface-container transition-all">
                          <span className="material-symbols-outlined text-primary text-3xl mb-2">cloud_upload</span>
                          <p className="text-sm font-bold text-on-background">{manualFile ? manualFile.name : "Tap to upload or drag and drop"}</p>
                          <p className="text-xs text-on-surface-variant mt-1">JPEG, PNG, WEBP (Max 5MB)</p>
                        </div>
                      </div>
                    </div>
                    
                    <button type="submit" disabled={manualVerifying} className="w-full min-h-[44px] px-6 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                      {manualVerifying ? "Submitting..." : "Submit Verification Request"}
                    </button>
                    
                    {manualError && <p className="text-error text-xs font-bold mt-2 bg-error/10 p-2.5 rounded-lg">{manualError}</p>}
                  </form>
                )}
              </div>
            )}
          </div>
        )}


        
        </div>
      </div>
      
      {/* Hidden file input for avatar */}
      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleAvatarUpload} />
    </div>
  );
}

export default Profile;
