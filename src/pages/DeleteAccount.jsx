import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "../lib/supabaseClient";
import { deleteOwnAccount } from "../lib/deleteAccount";
import { SITE_URL } from "../lib/seo";

function openLogin() {
  window.dispatchEvent(
    new CustomEvent("open-auth-modal", { detail: { tab: "login" } }),
  );
}

export default function DeleteAccount() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleDelete = async (event) => {
    event.preventDefault();
    if (!confirmed || deleting) return;

    setError("");
    setDeleting(true);
    try {
      await deleteOwnAccount();
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error("Sign-out after delete:", signOutError);
      }
      setDone(true);
    } catch (err) {
      console.error("Delete account failed:", err);
      setError(
        err?.message || "Could not delete your account. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="max-w-[640px] mx-auto px-4 sm:px-6 md:px-8 py-10 md:py-14 animate-fade-in w-full">
      <Helmet>
        <title>Delete account | Uni Deals</title>
        <meta
          name="description"
          content="Permanently delete your Uni Deals account, student verification documents, and related tickets."
        />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={`${SITE_URL}/delete-account`} />
      </Helmet>

      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant/60 font-body font-semibold">
        Uni Deals Trust Center
      </p>
      <h1 className="mt-2 text-3xl md:text-4xl font-headline font-black tracking-tight text-on-background">
        Delete account
      </h1>
      <p className="mt-3 text-sm text-on-surface-variant/80 font-body leading-relaxed">
        This page is public so you can close an account from the website or from
        a Play Store listing, without opening the app. Deletion is permanent.
      </p>

      <div className="mt-8 bg-surface-container-low border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-sm">
        {done ? (
          <div>
            <div className="w-14 h-14 rounded-full bg-primary-container/40 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-3xl">
                check_circle
              </span>
            </div>
            <h2 className="font-headline font-bold text-xl text-on-background mb-2">
              Account deleted
            </h2>
            <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
              Your Uni Deals login, role, ID documents, related tickets, and app
              push tokens have been removed. You are signed out.
            </p>
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl emerald-gradient px-6 py-3 font-headline text-sm font-bold tracking-tight text-on-primary shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
            >
              Back to home
            </Link>
          </div>
        ) : !authReady ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-on-surface-variant text-sm font-headline font-bold">
              Checking your session…
            </p>
          </div>
        ) : !session ? (
          <div>
            <h2 className="font-headline font-bold text-xl text-on-background mb-2">
              Sign in to continue
            </h2>
            <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
              Sign in with the account you want to delete. After you sign in you
              will stay on this page to confirm.
            </p>
            <button
              type="button"
              onClick={openLogin}
              className="min-h-[44px] w-full sm:w-auto emerald-gradient text-on-primary py-3 px-6 rounded-xl font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
            >
              Sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleDelete} className="space-y-5">
            <h2 className="font-headline font-bold text-xl text-on-background">
              Confirm deletion
            </h2>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              This will permanently delete{" "}
              <span className="font-semibold text-on-background">
                {session.user?.email || "this account"}
              </span>
              , including student ID photos, verification status, in-store
              tickets, and push tokens. You cannot undo this.
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
              />
              <span className="text-sm text-on-background font-body leading-relaxed">
                I understand this permanently deletes my Uni Deals account.
              </span>
            </label>
            {error && (
              <p className="text-error text-xs font-bold bg-error/10 p-2.5 rounded-lg">
                {error}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={!confirmed || deleting}
                className="min-h-[44px] px-6 py-3 rounded-xl bg-error text-white font-headline font-bold text-sm tracking-tight hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting…" : "Delete my account"}
              </button>
              <Link
                to="/privacy"
                className="min-h-[44px] inline-flex items-center justify-center px-6 py-3 rounded-xl border border-outline-variant/30 text-on-background font-headline font-bold text-sm hover:bg-surface-container transition-all"
              >
                Privacy Policy
              </Link>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
