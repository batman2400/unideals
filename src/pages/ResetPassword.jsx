/**
 * ResetPassword Page
 *
 * Landing page for the link in the "reset your password" email. Supabase
 * turns that link into a short-lived recovery session, which is the only
 * thing authorising the password change made here.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { PASSWORD_HINT, validatePasswordStrength } from "../lib/passwordPolicy";

// If the credential in the URL cannot be exchanged within this window,
// something is wrong with it and waiting longer just looks like a hang.
const SESSION_WAIT_MS = 10000;

function Shell({ children }) {
  return (
    <div className="max-w-md mx-auto px-4 md:px-8 py-10 md:py-16 animate-fade-in w-full">
      <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();

  // checking → ready → done, or invalid if the link cannot be used
  const [status, setStatus] = useState("checking");
  const [linkError, setLinkError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    let timeoutId;

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);

    // An expired or already-used link comes back as an error in the URL
    // rather than as a session, so read that first.
    const errorCode = hash.get("error_code") || query.get("error_code");
    if (errorCode) {
      setStatus("invalid");
      setLinkError(
        errorCode === "otp_expired"
          ? "This reset link has expired. Links are only valid for one hour, and each one can be used just once."
          : (hash.get("error_description") || query.get("error_description") || "")
              .replace(/\+/g, " ") ||
              "This reset link is no longer valid.",
      );
      window.history.replaceState({}, "", window.location.pathname);
      return () => {
        active = false;
      };
    }

    // The client may finish parsing the URL before or after this mounts,
    // so watch for the session and also check whether it already landed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session) return;
      setStatus("ready");
      window.history.replaceState({}, "", window.location.pathname);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!active) return;
        if (session) {
          setStatus("ready");
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }

        const carriesCredential = hash.has("access_token") || query.has("code");
        if (!carriesCredential) {
          setStatus("invalid");
          setLinkError(
            "Open the reset link from your email to set a new password.",
          );
          return;
        }

        timeoutId = setTimeout(() => {
          if (!active) return;
          setStatus((current) => (current === "checking" ? "invalid" : current));
          setLinkError(
            "We couldn't verify this reset link. Please request a new one.",
          );
        }, SESSION_WAIT_MS);
      })
      .catch((err) => {
        if (!active) return;
        console.error("[ResetPassword] Session lookup failed:", err);
        setStatus("invalid");
        setLinkError("We couldn't verify this reset link. Please try again.");
      });

    return () => {
      active = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inFlightRef.current) return;

    setSubmitError("");

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      setFieldError(strengthError);
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Both passwords must match.");
      return;
    }
    setFieldError("");

    inFlightRef.current = true;
    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error("Password update failed:", error);
        setSubmitError(
          /different from the old password/i.test(error.message)
            ? "Please choose a password you haven't used before."
            : error.message ||
                "We couldn't update your password. Please try again.",
        );
        return;
      }

      // Anyone who got in with the old password should not stay in.
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "others",
      });
      if (signOutError) {
        console.error("Could not revoke other sessions:", signOutError);
      }

      setStatus("done");
    } catch (err) {
      console.error("Unexpected password update error:", err);
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  };

  if (status === "checking") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant text-sm font-headline font-bold">
            Verifying your reset link...
          </p>
        </div>
      </Shell>
    );
  }

  if (status === "invalid") {
    return (
      <Shell>
        <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-error text-3xl">
            link_off
          </span>
        </div>
        <h1 className="font-headline font-bold text-xl text-on-background mb-2">
          This link won't work
        </h1>
        <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
          {linkError}
        </p>
        <button
          onClick={() => {
            navigate("/");
            window.dispatchEvent(new Event("open-auth-modal"));
          }}
          className="emerald-gradient text-on-primary py-3 px-6 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
        >
          Request a New Link
        </button>
      </Shell>
    );
  }

  if (status === "done") {
    return (
      <Shell>
        <div className="w-14 h-14 rounded-full bg-primary-container/40 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-primary text-3xl">
            check_circle
          </span>
        </div>
        <h1 className="font-headline font-bold text-xl text-on-background mb-2">
          Password Updated
        </h1>
        <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
          You're signed in with your new password, and any other devices that
          were signed in have been logged out.
        </p>
        <Link
          to="/"
          className="inline-block emerald-gradient text-on-primary py-3 px-6 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
        >
          Continue to Uni Deals
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-headline font-bold text-xl text-on-background mb-2">
        Choose a New Password
      </h1>
      <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
        Pick something you haven't used before. You'll stay signed in on this
        device once it's saved.
      </p>

      {submitError && (
        <div className="flex items-start gap-2 bg-error/10 border border-error/20 rounded-lg px-4 py-3 mb-4">
          <span className="material-symbols-outlined text-error text-lg flex-shrink-0 mt-0.5">
            error
          </span>
          <p className="text-error text-sm font-bold">{submitError}</p>
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
            New Password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={saving}
            autoFocus
            className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all disabled:opacity-50"
          />
          <p className="text-[11px] text-on-surface-variant/70 mt-1.5">
            {PASSWORD_HINT}
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
            Confirm New Password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={saving}
            className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all disabled:opacity-50"
          />
          {fieldError && (
            <p className="text-error text-xs font-bold mt-1.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">error</span>
              {fieldError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="emerald-gradient text-on-primary py-3.5 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            "Save New Password"
          )}
        </button>
      </form>
    </Shell>
  );
}
