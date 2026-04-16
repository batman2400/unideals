import { Navigate, useLocation } from "react-router-dom";
import { useRole } from "../lib/useRole";

function ProtectedRoute({ allowedRoles = [], children, redirectTo = "/" }) {
  const location = useLocation();
  const { role, loading, error, isAuthenticated } = useRole();

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
    return <Navigate to={redirectTo} replace state={{ from: location, authError: error }} />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={redirectTo} replace state={{ from: location, unauthorized: true }} />;
  }

  return children;
}

export default ProtectedRoute;
