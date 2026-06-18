import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRoleContext } from "../lib/RoleContext";

export default function Sidebar({ onLogout, isLoggedIn }) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { role } = useRoleContext();

  const handleOpenAuth = () => {
    setIsOpen(false);
    window.dispatchEvent(new Event("open-auth-modal"));
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const studentLinks = [
    { path: "/", label: "Explore", icon: "explore", exact: true },
    { path: "/events", label: "Events", icon: "event" },
    { path: "/saved", label: "Saved Deals", icon: "bookmark" },
  ];

  const studentFooterLinks = [
    { path: "/profile", label: "My Profile & Settings", icon: "person" },
    { path: "/support", label: "Help / Support", icon: "help" },
  ];

  const partnerLinks = [
    { path: "/partner", label: "Dashboard", icon: "dashboard", exact: true },
    { path: "/partner/deals", label: "Active Deals", icon: "local_offer" },
    { path: "/partner/create-deal", label: "Create a Deal", icon: "add_circle" },
    { path: "/events/new", label: "Create Event", icon: "event_available" },
    { path: "/partner/analytics", label: "Performance Analytics", icon: "monitoring" },
  ];

  const adminLinks = [
    { path: "/admin", label: "Platform Overview", icon: "dashboard", exact: true },
    { path: "/admin/verifications", label: "Pending Verifications", icon: "how_to_reg" },
    { path: "/admin/brands", label: "Manage Brands", icon: "storefront" },
    { path: "/events/new", label: "Create Event", icon: "event_available" },
    { path: "/admin/tickets", label: "Support Tickets", icon: "support_agent" },
  ];

  const getLinks = () => {
    if (role === "admin") return { main: adminLinks, footer: [] };
    if (role === "partner") return { main: partnerLinks, footer: [] };
    return { main: studentLinks, footer: studentFooterLinks };
  };

  const { main: navLinks, footer: footerLinks } = getLinks();

  const isActive = (link) => {
    if (link.exact) {
      return location.pathname === link.path;
    }
    return location.pathname.startsWith(link.path);
  };

  const NavItem = ({ link }) => {
    const active = isActive(link);
    return (
      <Link
        to={link.path}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-h-[44px] ${
          active
            ? "bg-primary-container/20 text-primary font-bold"
            : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-background font-medium"
        }`}
      >
        <span
          className={`material-symbols-outlined text-[22px] ${
            active ? "text-primary" : "text-on-surface-variant/70"
          }`}
          style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
        >
          {link.icon}
        </span>
        <span className="text-sm tracking-tight">{link.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Header Toggle */}
      <div className="md:hidden fixed top-0 left-0 w-full bg-surface/90 backdrop-blur-md border-b border-outline-variant/10 z-40 flex items-center gap-3 px-4 h-16">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 -ml-2 text-on-surface-variant hover:text-on-background min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>
        <Link to="/" className="flex items-center gap-2">
          <img src="/images/logo.png" alt="Uni Deals" className="h-6 w-auto" />
          <span className="font-headline font-black text-lg tracking-tight text-on-background">
            Uni<span className="text-primary">Deals</span>
          </span>
        </Link>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-[100dvh] w-72 bg-surface border-r border-outline-variant/10 z-50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Brand / Logo Area */}
        <div className="flex items-center justify-between px-6 h-20 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
            <img src="/images/logo.png" alt="Uni Deals" className="h-8 w-auto" />
            <span className="font-headline font-black text-2xl tracking-tighter text-on-background">
              Uni<span className="text-primary">Deals</span>
            </span>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden p-2 -mr-2 text-on-surface-variant hover:bg-surface-container rounded-full"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1 scrollbar-hide">
          {navLinks.map((link) => (
            <NavItem key={link.path} link={link} />
          ))}
        </nav>

        {/* Footer Area */}
        <div className="mt-auto p-4 border-t border-outline-variant/10 bg-surface-container-lowest/50 space-y-1 flex-shrink-0">
          {footerLinks.map((link) => {
            // Hide profile link if not logged in
            if (link.path === "/profile" && !isLoggedIn) return null;
            return <NavItem key={link.path} link={link} />;
          })}

          {isLoggedIn ? (
            <button
              onClick={() => {
                if (onLogout) onLogout();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-h-[44px] text-error hover:bg-error/10 font-medium mt-2"
            >
              <span className="material-symbols-outlined text-[22px]">logout</span>
              <span className="text-sm tracking-tight">Log Out</span>
            </button>
          ) : (
            <button
              onClick={handleOpenAuth}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all min-h-[44px] bg-primary text-on-primary font-bold mt-2 hover:bg-primary/90"
            >
              <span className="text-sm tracking-tight">Log In or Sign Up</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
