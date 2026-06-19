import { Link, useLocation } from "react-router-dom";
import { useRoleContext } from "../lib/RoleContext";

export default function Navbar({ onLogout, isLoggedIn }) {
  const location = useLocation();
  const { role, loading } = useRoleContext();

  const handleOpenAuth = () => {
    window.dispatchEvent(new Event("open-auth-modal"));
  };

  const navLinks = [
    { path: "/", label: "Explore" },
    { path: "/events", label: "Events" },
    { path: "/saved", label: "Saved Deals" },
  ];

  const isActive = (path) => {
    if (path === "/" || path === "/admin" || path === "/partner") {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="hidden md:flex items-center justify-between h-20 px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-md sticky top-0 z-50">
      {/* Left: Logo */}
      <Link to="/" className="flex items-center gap-2">
        <img src="/images/logo.png" alt="Uni Deals" className="h-8 w-auto" />
        <span className="font-headline font-black text-2xl tracking-tighter text-on-background">
          Uni<span className="text-primary">Deals</span>
        </span>
      </Link>

      {/* Center: Links */}
      <div className="flex items-center gap-8">
        {navLinks.map((link) => {
          const active = isActive(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`relative font-headline font-bold text-base tracking-tight transition-colors duration-200 py-1 ${
                active ? "text-primary after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:bg-primary after:rounded-full" : "text-on-surface-variant hover:text-on-background"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {isLoggedIn ? (
          <>
            {loading ? (
              <div className="hidden lg:block w-[140px] h-[36px] rounded-full skeleton-shimmer bg-surface-container-low" />
            ) : (role === "admin" || role === "partner") ? (
              <>
                <Link
                  to="/partner/scanner"
                  className="hidden lg:flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100 rounded-full transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                  <span className="font-headline font-bold text-sm">Scanner</span>
                </Link>
                <Link
                  to={role === "admin" ? "/admin" : "/partner"}
                  className="hidden lg:flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-full transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">dashboard</span>
                  <span className="font-headline font-bold text-sm">
                    {role === "admin" ? "Admin Portal" : "Partner Portal"}
                  </span>
                </Link>
              </>
            ) : null}
            <Link
              to="/profile"
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-outline-variant/20 hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-lg">person</span>
              <span className="font-headline font-bold text-sm">My Profile</span>
            </Link>
            <Link
              to="/support"
              title="Help / Support"
              className="p-2 text-on-surface-variant hover:text-on-background hover:bg-surface-container rounded-full transition-colors flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[22px]">help</span>
            </Link>
            <button
              onClick={onLogout}
              title="Log Out"
              className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-full transition-colors flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[22px]">logout</span>
            </button>
          </>
        ) : (
          <>
            <Link
              to="/support"
              title="Help / Support"
              className="p-2 text-on-surface-variant hover:text-on-background hover:bg-surface-container rounded-full transition-colors flex items-center justify-center mr-2"
            >
              <span className="material-symbols-outlined text-[22px]">help</span>
            </Link>
            <button
              onClick={handleOpenAuth}
              className="font-headline font-bold text-sm px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary/90 transition-all shadow-sm"
            >
              Log In
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
