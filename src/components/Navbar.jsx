import { Link, useLocation } from "react-router-dom";
import { useRoleContext } from "../lib/RoleContext";

export default function Navbar({ onLogout, isLoggedIn }) {
  const location = useLocation();
  const { role } = useRoleContext();

  const handleOpenAuth = () => {
    window.dispatchEvent(new Event("open-auth-modal"));
  };

  const studentLinks = [
    { path: "/", label: "Explore" },
    { path: "/events", label: "Events" },
    { path: "/saved", label: "Saved Deals" },
  ];

  const partnerLinks = [
    { path: "/partner", label: "Dashboard" },
    { path: "/partner/deals", label: "Active Deals" },
    { path: "/partner/create-deal", label: "Create a Deal" },
    { path: "/partner/analytics", label: "Analytics" },
  ];

  const adminLinks = [
    { path: "/admin", label: "Overview" },
    { path: "/admin/verifications", label: "Verifications" },
    { path: "/admin/brands", label: "Brands" },
    { path: "/admin/tickets", label: "Support Tickets" },
  ];

  const navLinks = role === "admin" ? adminLinks : role === "partner" ? partnerLinks : studentLinks;

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
      <div className="flex items-center gap-6">
        {navLinks.map((link) => {
          const active = isActive(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`font-headline font-bold text-sm tracking-tight transition-colors ${
                active ? "text-primary" : "text-on-surface-variant hover:text-on-background"
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
