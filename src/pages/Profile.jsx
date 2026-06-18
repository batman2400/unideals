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
    <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-10 animate-fade-in space-y-8">
      {/* Header section */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="relative avatar-upload-container group">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden shadow-lg border-4 border-surface bg-surface-container">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl">person</span>
              </div>
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
        
        <div>
          <h1 className="font-headline font-extrabold text-2xl tracking-tighter text-on-background">
            {user?.user_metadata?.full_name?.split(' ')[0] || "Student"}
          </h1>
          <div className="mt-1 flex items-center justify-center">
            {isVerified || role === "admin" || role === "partner" ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Verified Account
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

      {/* Student ID Card */}
      <div className="mt-8 id-card-glass rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row items-center gap-5 w-full max-w-sm mx-auto md:max-w-md shadow-xl">
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
              {fullName}
            </p>
            <p className="text-xs text-on-surface-variant/60 truncate">Uni Deals iD</p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-col gap-4 sm:gap-2 text-xs w-full sm:w-auto">
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

      {/* Settings Blocks */}
      <div className="space-y-6" ref={settingsRef}>
        
        {/* University Email Verification Card */}
        {role === "student" && !isVerified && (
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5 md:p-6 shadow-sm">
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
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5 md:p-6 shadow-sm">
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

        {/* Preferences / Account Security Card */}
        <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5 md:p-6 shadow-sm">
          <h3 className="font-headline font-bold text-base text-on-background mb-4">Account Security</h3>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Change Password</label>
              <input type="password" placeholder="Leave blank to keep current" value={settingsPassword} onChange={(e) => setSettingsPassword(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[44px] text-sm text-on-background focus:outline-none focus:border-primary transition-all" />
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
      
      {/* Hidden file input for avatar */}
      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleAvatarUpload} />
    </div>
  );
}

export default Profile;
