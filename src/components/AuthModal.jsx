/**
 * AuthModal Component
 *
 * A centered overlay modal with Login / Sign Up tabs.
 * Wired to Supabase Auth:
 *   - Login tab  → supabase.auth.signInWithPassword()
 *   - Sign Up tab → supabase.auth.signUp()
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
 */
import { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  PASSWORD_HINT,
  describeAuthFailure,
  validatePasswordStrength,
} from "../lib/passwordPolicy";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function AuthModal({ isOpen, onClose }) {
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
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const inFlightRef = useRef(false);

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
  };

  const openForgot = () => {
    setShowForgot(true);
    setResetSent(false);
    setPassword("");
    setErrors({});
    setAuthError("");
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

    inFlightRef.current = true;
    setLoading(true);

    try {
      if (activeTab === "signup") {
        // ── Sign Up ──────────────────────────────────────
        const { error } = await supabase.auth.signUp({
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

        if (error) {
          console.error("Signup failed:", error);
          // Deliberately generic: a message like "User already registered"
          // lets an attacker enumerate which emails hold accounts.
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

              {/* Supabase auth error banner */}
              {authError && (
                <div className="flex items-start gap-2 bg-error/10 border border-error/20 rounded-lg px-4 py-3 mb-4 animate-modal-enter">
                  <span className="material-symbols-outlined text-error text-lg flex-shrink-0 mt-0.5">
                    error
                  </span>
                  <p className="text-error text-sm font-bold">{authError}</p>
                </div>
              )}

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
                    onChange={(e) => setEmail(e.target.value)}
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
                        Sign up with any email — you can link your university
                        email later in your profile for instant student
                        verification.
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
                  disabled={loading}
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
