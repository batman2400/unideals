/**
 * AuthCallback (/auth/callback)
 *
 * Google (and other OAuth providers) return here with a PKCE `code`.
 * supabase-js exchanges it via detectSessionInUrl, then we send the
 * user back to the page they started from.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "../lib/supabaseClient";
import { consumeReturnPath } from "../lib/authRedirect";

const SESSION_WAIT_MS = 12000;

function Spinner({ label }) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <Helmet>
        <title>Signing in | Uni Deals</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-on-surface-variant text-sm font-headline font-bold">
          {label}
        </p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const urlError =
      query.get("error_description") ||
      hash.get("error_description") ||
      query.get("error") ||
      hash.get("error");

    if (urlError) {
      const friendly = urlError.replace(/\+/g, " ");
      const params = new URLSearchParams({
        error: query.get("error") || hash.get("error") || "access_denied",
        error_description: friendly,
      });
      navigate(`/?${params.toString()}`, { replace: true });
      return () => {
        active = false;
      };
    }

    const goHome = (session) => {
      if (!active || !session) return;
      const next = consumeReturnPath();
      navigate(next, { replace: true });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      goHome(session);
    });

    void supabase.auth.getSession().then(({ data }) => {
      goHome(data.session);
    });

    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      setError(
        "Google sign-in didn't finish. Please try again — if this keeps happening, the Google provider may not be enabled in Supabase yet.",
      );
    }, SESSION_WAIT_MS);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <Helmet>
          <title>Sign-in failed | Uni Deals</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="max-w-md w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl p-6 md:p-8 text-center shadow-sm">
          <h1 className="font-headline font-extrabold text-xl text-on-background mb-2">
            Couldn't finish Google sign-in
          </h1>
          <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
            {error}
          </p>
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="emerald-gradient text-on-primary py-3 px-8 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
          >
            Back to Uni Deals
          </button>
        </div>
      </div>
    );
  }

  return <Spinner label="Finishing Google sign-in..." />;
}
