/**
 * AuthModal Component
 *
 * A centered overlay modal with Login / Sign Up tabs.
 * Wired to Supabase Auth:
 *   - Login tab  → supabase.auth.signInWithPassword()
 *   - Sign Up tab → supabase.auth.signUp()
 *   - Google      → supabase.auth.signInWithOAuth({ provider: "google" })
 *
 * Features:
 *   - Controlled form inputs via useState
 *   - Frontend validation + Supabase error display
 *   - Loading state during auth requests
 *   - Auto-closes on success
 *
 * Props:
 *   - isOpen     : boolean — controls visibility
 *   - onClose    : function — called to close the modal
 *   - initialError : string — optional error to show when the modal opens
 *                    (e.g. OAuth redirect failure)
 *   - initialTab : "login" | "signup" | null — tab to open on (e.g. /signup)
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  getOAuthRedirectUrl,
  rememberReturnPath,
} from "../lib/authRedirect";
import {
  EXISTING_ACCOUNT_MESSAGE,
  PASSWORD_HINT,
  describeAuthFailure,
  isExistingAccountSignup,
  validatePasswordStrength,
} from "../lib/passwordPolicy";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function GoogleMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AuthModal({ isOpen, onClose, initialError = "", initialTab = null }) {
  // Toggle between "login" and "signup" tabs
  const [activeTab, setActiveTab] = useState("login");

  // ── Form State ────────────────────────────────────────
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ── UI State ──────────────────────────────────────────
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (isOpen && initialError) {
      setAuthError(initialError);
      setShowForgot(false);
      setSignupSuccess(false);
      setResetSent(false);
      setExistingAccount(false);
    }
  }, [isOpen, initialError]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialTab !== "login" && initialTab !== "signup") return;
    setActiveTab(initialTab);
    setShowForgot(false);
    setSignupSuccess(false);
    setResetSent(false);
  }, [isOpen, initialTab]);

  // Reset form when switching tabs
  const switchTab = (tab) => {
    setActiveTab(tab);
    setFullName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setErrors({});
    setAuthError("");
    setSignupSuccess(false);
    setShowForgot(false);
    setResetSent(false);
    setExistingAccount(false);
    setOauthLoading(false);
  };

  const showExistingAccountNotice = () => {
    setActiveTab("login");
    setFullName("");
    setUsername("");
    setErrors({});
    setAuthError("");
    setSignupSuccess(false);
    setShowForgot(false);
    setResetSent(false);
    setExistingAccount(true);
  };

  // ── Google OAuth ──────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (inFlightRef.current) return;

    setAuthError("");
    inFlightRef.current = true;
    setOauthLoading(true);

    try {
      // Always return through /auth/callback (allowlisted), then restore
      // the page the user was on. Sending the current path as redirectTo
      // fails unless every route is listed in Supabase Redirect URLs.
      rememberReturnPath();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getOAuthRedirectUrl(),
          queryParams: {
            // Always show the account picker so shared devices don't auto-pick.
            prompt: "select_account",
          },
        },
      });

      if (error) {
        console.error("Google sign-in failed:", error);
        setAuthError(
          describeAuthFailure(
            error,
            "Google sign-in didn't work. Please try again.",
          ),
        );
        inFlightRef.current = false;
        setOauthLoading(false);
      }
      // On success the browser redirects away — no need to reset loading.
    } catch (err) {
      console.error("Unexpected Google sign-in error:", err);
      setAuthError("An unexpected error occurred. Please try again.");
      inFlightRef.current = false;
      setOauthLoading(false);
    }
  };

  const openForgot = () => {
    setShowForgot(true);
    setResetSent(false);
    setPassword("");
    setErrors({});
    setAuthError("");
    setExistingAccount(false);
  };

  // ── Password Reset Request ────────────────────────────
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (inFlightRef.current) return;

    setAuthError("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setErrors({ email: "Please enter a valid email address." });
      return;
    }
    setErrors({});

    inFlightRef.current = true;
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo: `${window.location.origin}/reset-password` },
      );

      if (error) {
        console.error("Password reset request failed:", error);
        setAuthError(
          describeAuthFailure(
            error,
            "We couldn't send that reset link. Please try again.",
          ),
        );
        return;
      }

      // Shown regardless of whether the address has an account, so this
      // screen cannot be used to discover which emails are registered.
      setResetSent(true);
    } catch (err) {
      console.error("Unexpected password reset error:", err);
      setAuthError("An unexpected error occurred. Please try again.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  // ── Frontend Validation ───────────────────────────────
  const validate = () => {
    const newErrors = {};
    const normalizedEmail = email.trim().toLowerCase();

    if (activeTab === "signup" && fullName.trim().length === 0) {
      newErrors.fullName = "Full name is required.";
    }

    if (activeTab === "signup" && username.trim().length < 3) {
      newErrors.username = "Username must be at least 3 characters.";
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (activeTab === "signup") {
      const passwordError = validatePasswordStrength(password);
      if (passwordError) newErrors.password = passwordError;
    } else if (password.length === 0) {
      newErrors.password = "Please enter your password.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Form Submission → Supabase Auth ───────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    // A ref closes the double-click window that `disabled={loading}` leaves
    // open, since setLoading only takes effect on re-render.
    if (inFlightRef.current) return;

    setAuthError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!validate()) return;

    setExistingAccount(false);

    inFlightRef.current = true;
    setLoading(true);

    try {
      if (activeTab === "signup") {
        // ── Sign Up ──────────────────────────────────────
        const requestStartedAt = Date.now();
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              username: username.trim(),
            },
          },
        });

        if (isExistingAccountSignup(error, data, requestStartedAt)) {
          showExistingAccountNotice();
          return;
        }

        if (error) {
          console.error("Signup failed:", error);
          setAuthError(
            describeAuthFailure(
              error,
              "We couldn't create that account. Please check your details and try again.",
            ),
          );
          return;
        }

        // Show confirmation message (Supabase sends verification email)
        setSignupSuccess(true);
      } else {
        // ── Login ────────────────────────────────────────
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) {
          console.error("Login failed:", error);
          setAuthError(
            error.message === "Email not confirmed"
              ? "Please confirm your email address first. Check your inbox for the link."
              : describeAuthFailure(error, "Invalid email or password."),
          );
          return;
        }

        // Success — session is set by onAuthStateChange in App.jsx
        setFullName("");
        setUsername("");
        setEmail("");
        setPassword("");
        setErrors({});
        setAuthError("");
        onClose();
      }
    } catch (err) {
      console.error("Unexpected auth error:", err);
      setAuthError("An unexpected error occurred. Please try again.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  // Don't render anything when modal is closed
  if (!isOpen) return null;

  return (
    // Backdrop — click to close
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      {/* Modal Card — stop clicks from bubbling to backdrop */}
      <div
        data-clarity-mask="true"
        className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className="absolute top-4 right-4 text-on-surface-variant/60 hover:text-on-surface transition-colors z-10"
          onClick={onClose}
          aria-label="Close modal"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>

        {/* Header accent bar */}
        <div className="h-1.5 emerald-gradient" />

        <div className="p-6 sm:p-8 pt-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-2 mb-6">
            <img
              src="/images/logo.png"
              alt="Uni Deals"
              className="h-10 w-auto"
            />
            <h2 className="font-headline font-black text-2xl tracking-tighter text-on-background">
              Uni Deals
            </h2>
          </div>

          {/* Password reset link sent */}
          {resetSent ? (
            <div className="text-center animate-modal-enter">
              <div className="w-16 h-16 rounded-full bg-primary-container/40 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-primary text-3xl">
                  mark_email_read
                </span>
              </div>
              <h3 className="font-headline font-bold text-lg text-on-background mb-2">
                Check Your Email
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                If an account exists for{" "}
                <span className="font-bold text-on-surface">{email}</span>,
                we've sent a link to reset your password. The link expires in
                one hour.
              </p>
              <button
                onClick={() => switchTab("login")}
                className="emerald-gradient text-on-primary py-3 px-8 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
              >
                Back to Login
              </button>
            </div>
          ) : showForgot ? (
            <div className="animate-modal-enter">
              <h3 className="font-headline font-bold text-lg text-on-background mb-2">
                Reset Your Password
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                Enter the email address you signed up with and we'll send you a
                link to choose a new password.
              </p>

              {authError && (
                <div className="flex items-start gap-2 bg-error/10 border border-error/20 rounded-lg px-4 py-3 mb-4">
                  <span className="material-symbols-outlined text-error text-lg flex-shrink-0 mt-0.5">
                    error
                  </span>
                  <p className="text-error text-sm font-bold">{authError}</p>
                </div>
              )}

              <form className="flex flex-col gap-4" onSubmit={handleForgotSubmit}>
                <div>
                  <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoFocus
                    className={`w-full bg-surface-container-low border rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all disabled:opacity-50 ${
                      errors.email
                        ? "border-error ring-1 ring-error/30"
                        : "border-outline-variant/20"
                    }`}
                  />
                  {errors.email && (
                    <p className="text-error text-xs font-bold mt-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">
                        error
                      </span>
                      {errors.email}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="emerald-gradient text-on-primary py-3.5 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                      Sending Link...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>

              <p className="text-center text-xs text-on-surface-variant/50 mt-6">
                Remembered it?{" "}
                <button
                  className="text-primary font-bold hover:underline"
                  onClick={() => switchTab("login")}
                >
                  Back to login
                </button>
              </p>
            </div>
          ) : signupSuccess ? (
            <div className="text-center animate-modal-enter">
              <div className="w-16 h-16 rounded-full bg-primary-container/40 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-primary text-3xl">
                  mark_email_read
                </span>
              </div>
              <h3 className="font-headline font-bold text-lg text-on-background mb-2">
                Check Your Email
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                We've sent a confirmation link to{" "}
                <span className="font-bold text-on-surface">{email}</span>.
                Click the link to verify your account, then log in.
              </p>
              <button
                onClick={() => {
                  setSignupSuccess(false);
                  switchTab("login");
                }}
                className="emerald-gradient text-on-primary py-3 px-8 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
              >
                Go to Login
              </button>
            </div>
          ) : (
            <>
              {/* Tab switcher */}
              <div className="flex rounded-xl bg-surface-container-low p-1 mb-8">
                <button
                  className={`flex-1 py-2.5 text-sm font-headline font-bold tracking-tight rounded-lg transition-all ${
                    activeTab === "login"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                  onClick={() => switchTab("login")}
                >
                  Login
                </button>
                <button
                  className={`flex-1 py-2.5 text-sm font-headline font-bold tracking-tight rounded-lg transition-all ${
                    activeTab === "signup"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                  onClick={() => switchTab("signup")}
                >
                  Sign Up
                </button>
              </div>

              {existingAccount && (
                <div className="flex items-start gap-2 bg-primary-container/30 border border-primary/20 rounded-lg px-4 py-3 mb-4 animate-modal-enter">
                  <span className="material-symbols-outlined text-primary text-lg flex-shrink-0 mt-0.5">
                    info
                  </span>
                  <div>
                    <p className="text-on-background text-sm font-bold leading-relaxed">
                      {EXISTING_ACCOUNT_MESSAGE}
                    </p>
                    <button
                      type="button"
                      onClick={openForgot}
                      className="text-primary text-xs font-bold hover:underline mt-1.5"
                    >
                      Reset password
                    </button>
                  </div>
                </div>
              )}

              {/* Supabase auth error banner */}
              {authError && (
                <div className="flex items-start gap-2 bg-error/10 border border-error/20 rounded-lg px-4 py-3 mb-4 animate-modal-enter">
                  <span className="material-symbols-outlined text-error text-lg flex-shrink-0 mt-0.5">
                    error
                  </span>
                  <p className="text-error text-sm font-bold">{authError}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading || oauthLoading}
                className="w-full flex items-center justify-center gap-3 bg-surface border border-outline-variant/25 text-on-surface py-3.5 rounded-lg font-headline font-bold text-sm tracking-tight hover:bg-surface-container-low active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mb-5"
              >
                {oauthLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-on-surface/40 border-t-transparent rounded-full animate-spin" />
                    Redirecting to Google...
                  </>
                ) : (
                  <>
                    <GoogleMark className="w-5 h-5" />
                    Continue with Google
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-outline-variant/20" />
                <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-on-surface-variant/50">
                  or
                </span>
                <div className="h-px flex-1 bg-outline-variant/20" />
              </div>

              {/* Form */}
              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                {activeTab === "signup" && (
                  <>
                    <div>
                      <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        placeholder="Jane Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={loading}
                        className={`w-full bg-surface-container-low border rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all disabled:opacity-50 ${
                          errors.fullName
                            ? "border-error ring-1 ring-error/30"
                            : "border-outline-variant/20"
                        }`}
                      />
                      {errors.fullName && (
                        <p className="text-error text-xs font-bold mt-1.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">
                            error
                          </span>
                          {errors.fullName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        placeholder="jane_doe"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                        className={`w-full bg-surface-container-low border rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all disabled:opacity-50 ${
                          errors.username
                            ? "border-error ring-1 ring-error/30"
                            : "border-outline-variant/20"
                        }`}
                      />
                      {errors.username && (
                        <p className="text-error text-xs font-bold mt-1.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">
                            error
                          </span>
                          {errors.username}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (existingAccount) setExistingAccount(false);
                    }}
                    disabled={loading}
                    className={`w-full bg-surface-container-low border rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all disabled:opacity-50 ${
                      errors.email
                        ? "border-error ring-1 ring-error/30"
                        : "border-outline-variant/20"
                    }`}
                  />
                  {activeTab === "signup" && (
                    <div className="mt-2 rounded-lg border border-primary/15 bg-primary-container/20 px-3 py-2">
                      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-on-surface-variant/80">
                        <span className="material-symbols-outlined text-sm text-primary mt-0.5">
                          mail
                        </span>
                        Sign up with any email — then verify from Profile.
                        A university email code verifies you immediately; ID review is only if you do not have one.
                      </p>
                    </div>
                  )}
                  {errors.email && (
                    <p className="text-error text-xs font-bold mt-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">
                        error
                      </span>
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    autoComplete={activeTab === "signup" ? "new-password" : "current-password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className={`w-full bg-surface-container-low border rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all disabled:opacity-50 ${
                      errors.password
                        ? "border-error ring-1 ring-error/30"
                        : "border-outline-variant/20"
                    }`}
                  />
                  {activeTab === "signup" && !errors.password && (
                    <p className="text-[11px] text-on-surface-variant/70 mt-1.5">
                      {PASSWORD_HINT}
                    </p>
                  )}
                  {errors.password && (
                    <p className="text-error text-xs font-bold mt-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">
                        error
                      </span>
                      {errors.password}
                    </p>
                  )}
                  {activeTab === "login" && (
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={openForgot}
                        className="text-primary text-xs font-bold hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || oauthLoading}
                  className="emerald-gradient text-on-primary py-3.5 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                      {activeTab === "login"
                        ? "Signing In..."
                        : "Creating Account..."}
                    </>
                  ) : activeTab === "login" ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>

              {/* Footer text */}
              <p className="text-center text-xs text-on-surface-variant/50 mt-6">
                {activeTab === "login" ? (
                  <>
                    Don't have an account?{" "}
                    <button
                      className="text-primary font-bold hover:underline"
                      onClick={() => switchTab("signup")}
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already a member?{" "}
                    <button
                      className="text-primary font-bold hover:underline"
                      onClick={() => switchTab("login")}
                    >
                      Login
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
