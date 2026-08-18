import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useRoleContext } from "../lib/RoleContext";

// Every route behind ProtectedRoute is a personal dashboard or
// role-gated tool (profile, saved deals, partner/admin panels, event
// submission) — none of it is content search engines should index.
function NoIndexTag() {
  return (
    <Helmet>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );
}

function openAuthModal() {
  window.dispatchEvent(new Event("open-auth-modal"));
}

function SignInRequired() {
  useEffect(() => {
    openAuthModal();
  }, []);

  return (
    <section className="max-w-[760px] mx-auto px-6 py-16 text-center animate-fade-in">
      <NoIndexTag />
      <span className="material-symbols-outlined text-6xl text-primary mb-4">
        login
      </span>
      <h1 className="font-headline font-bold text-3xl text-on-background mb-2">
        Sign In Required
      </h1>
      <p className="text-on-surface-variant mb-6 max-w-md mx-auto">
        You need to be signed in to access this. Sign in or create an account to
        continue.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={openAuthModal}
          className="px-6 py-2.5 bg-primary text-on-primary font-headline font-bold rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98]"
        >
          Sign In
        </button>
        <Link
          to="/"
          className="px-6 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface-variant font-headline font-bold hover:bg-surface-container-low transition-all"
        >
          Back to Home
        </Link>
      </div>
    </section>
  );
}

function ProtectedRoute({ allowedRoles = [], children, redirectTo = "/" }) {
  const { role, loading, error, isAuthenticated, refreshRole } =
    useRoleContext();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <NoIndexTag />
        <div className="flex items-center gap-3 text-on-surface-variant">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-headline font-bold">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SignInRequired />;
  }

  if (error) {
    return (
      <section className="max-w-[760px] mx-auto px-6 py-16">
        <NoIndexTag />
        <div className="bg-error/10 border border-error/20 rounded-2xl p-6 md:p-8">
          <h2 className="font-headline font-extrabold text-2xl text-on-background tracking-tight mb-2">
            We could not verify your access
          </h2>
          <p className="text-on-surface-variant text-sm md:text-base mb-6">
            This is usually temporary. Please retry role verification.
          </p>
          <p className="text-error text-sm font-bold mb-6">{error}</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={refreshRole}
              className="emerald-gradient text-on-primary px-5 py-2.5 rounded-lg font-headline font-bold text-sm tracking-tight shadow-sm hover:shadow-md transition-all"
            >
              Retry
            </button>
            <Link
              to={redirectTo}
              className="px-5 py-2.5 rounded-lg border border-outline-variant/20 text-on-surface-variant font-headline font-bold text-sm tracking-tight hover:bg-surface-container-low transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return (
      <section className="max-w-[760px] mx-auto px-6 py-16 text-center animate-fade-in">
        <NoIndexTag />
        <span className="material-symbols-outlined text-6xl text-primary mb-4">
          lock
        </span>
        <h1 className="font-headline font-bold text-3xl text-on-background mb-2">
          Access denied
        </h1>
        <p className="text-on-surface-variant mb-6 max-w-md mx-auto">
          Your account does not have permission to view this page.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/profile"
            className="px-6 py-2.5 bg-primary text-on-primary font-headline font-bold rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98]"
          >
            Go to Profile
          </Link>
          <Link
            to={redirectTo}
            className="px-6 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface-variant font-headline font-bold hover:bg-surface-container-low transition-all"
          >
            Back to Home
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <NoIndexTag />
      {children}
    </>
  );
}

export default ProtectedRoute;
