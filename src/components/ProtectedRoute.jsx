import { Link, Navigate, useLocation } from "react-router-dom";
import { useRole } from "../lib/useRole";

function ProtectedRoute({ allowedRoles = [], children, redirectTo = "/" }) {
  const location = useLocation();
  const { role, loading, error, isAuthenticated, refreshRole } = useRole();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-headline font-bold">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  if (error) {
    return (
      <section className="max-w-[760px] mx-auto px-6 py-16">
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
    return <Navigate to={redirectTo} replace state={{ from: location, unauthorized: true }} />;
  }

  return children;
}

export default ProtectedRoute;
