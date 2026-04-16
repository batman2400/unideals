/**
 * AuthModal Component
 *
 * A centered overlay modal with Login / Sign Up tabs.
 * Closes when you click the backdrop or the ✕ button.
 *
 * Features:
 *   - Controlled form inputs via useState
 *   - Frontend validation (email must contain @, password ≥ 8 chars)
 *   - Inline error messages below each field
 *   - Simulated login via console.log on success
 *
 * Props:
 *   - isOpen     : boolean — controls visibility
 *   - onClose    : function — called to close the modal
 */
import { useState } from "react";

function AuthModal({ isOpen, onClose }) {
  // Toggle between "login" and "signup" tabs
  const [activeTab, setActiveTab] = useState("login");

  // ── Form State ────────────────────────────────────────
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ── Validation Errors ─────────────────────────────────
  const [errors, setErrors] = useState({});

  // Reset form when switching tabs
  const switchTab = (tab) => {
    setActiveTab(tab);
    setFullName("");
    setEmail("");
    setPassword("");
    setErrors({});
  };

  // ── Validation Logic ──────────────────────────────────
  const validate = () => {
    const newErrors = {};

    // Full name (signup only)
    if (activeTab === "signup" && fullName.trim().length === 0) {
      newErrors.fullName = "Full name is required.";
    }

    // Email — must contain @
    if (!email.includes("@")) {
      newErrors.email = "Please enter a valid email address (must contain @).";
    } else if (email.trim().length < 3) {
      newErrors.email = "Email is too short.";
    }

    // Password — must be at least 8 characters
    if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Form Submission ───────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) return;

    // Simulate successful auth
    console.log(
      `[Auth] ${activeTab === "login" ? "Login" : "Sign Up"} successful`,
      { email, fullName: activeTab === "signup" ? fullName : undefined }
    );

    // Reset & close
    setFullName("");
    setEmail("");
    setPassword("");
    setErrors({});
    onClose();
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
            <img src="/images/logo.png" alt="Uni Deals" className="h-10 w-auto" />
            <h2 className="font-headline font-black text-2xl tracking-tighter text-on-background">
              Uni Deals
            </h2>
          </div>

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

          {/* Form */}
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {activeTab === "signup" && (
              <div>
                <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full bg-surface-container-low border rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all ${
                    errors.fullName
                      ? "border-error ring-1 ring-error/30"
                      : "border-outline-variant/20"
                  }`}
                />
                {errors.fullName && (
                  <p className="text-error text-xs font-bold mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">error</span>
                    {errors.fullName}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                Email
              </label>
              <input
                type="text"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-surface-container-low border rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all ${
                  errors.email
                    ? "border-error ring-1 ring-error/30"
                    : "border-outline-variant/20"
                }`}
              />
              {errors.email && (
                <p className="text-error text-xs font-bold mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">error</span>
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-surface-container-low border rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all ${
                  errors.password
                    ? "border-error ring-1 ring-error/30"
                    : "border-outline-variant/20"
                }`}
              />
              {errors.password && (
                <p className="text-error text-xs font-bold mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">error</span>
                  {errors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="emerald-gradient text-on-primary py-3.5 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all mt-2"
            >
              {activeTab === "login" ? "Sign In" : "Create Account"}
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
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
