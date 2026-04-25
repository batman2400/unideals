/**
 * Navbar Component
 *
 * The fixed navigation bar at the top of the page.
 * Features:
 *   - Active route detection via useLocation (emerald bottom border)
 *   - Hamburger menu toggle for mobile (useState)
 *   - Search input bound to global state
 *   - Conditional auth: Login/Join buttons OR User Avatar dropdown
 *   - Real Supabase logout via onLogout prop
 *
 * Props:
 *   - onOpenAuth    : function — opens the AuthModal
 *   - searchQuery   : string — current search text
 *   - onSearchChange: function — updates search text
 *   - isLoggedIn    : boolean — whether user is authenticated
 *   - user          : object|null — Supabase user object
 *   - onLogout      : function — calls supabase.auth.signOut()
 */
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRole } from "../lib/useRole";

function Navbar({ onOpenAuth, searchQuery, onSearchChange, isLoggedIn, user, onLogout }) {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarRef = useRef(null);
  const { role } = useRole();

  const canAccessPartnerPortal = role === "partner" || role === "admin";
  const canAccessAdminPanel = role === "admin";

  // Close avatar dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Derive user display info from Supabase user object ──
  const userEmail = user?.email ?? "user@example.com";
  const fullName =
    user?.user_metadata?.full_name ||
    userEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const initials = fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const avatarUrl = user?.user_metadata?.avatar_url || null;

  // Nav link data
  const navLinks = [
    { to: "/perks", label: "Perks" },
    { to: "/categories", label: "Categories" },
    { to: "/brands", label: "Brands" },
  ];

  // Helper — returns classes for an active vs inactive link
  const linkClasses = (to) => {
    const isActive = pathname === to;
    return isActive
      ? "text-[#29695b] dark:text-[#afefdd] border-b-2 border-[#29695b] pb-1 font-headline font-bold tracking-tight transition-colors"
      : "text-[#323233]/60 dark:text-[#fcf9f8]/60 font-headline font-bold tracking-tight hover:text-[#29695b] dark:hover:text-[#afefdd] transition-colors";
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#fcf9f8]/80 dark:bg-[#323233]/80 backdrop-blur-xl">
      <div className="flex justify-between items-center px-4 sm:px-6 md:px-8 py-3 md:py-4 max-w-[1440px] mx-auto">
        {/* Left side: Logo + Nav Links */}
        <div className="flex items-center gap-6 md:gap-12">
          <Link
            to="/"
            className="flex items-center gap-2"
          >
            <img src="/images/logo.png" alt="Uni Deals" className="h-7 md:h-8 w-auto" />
            <span className="text-xl md:text-2xl font-black text-[#323233] dark:text-[#fcf9f8] tracking-tighter font-headline">
              Uni Deals
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex gap-8">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className={linkClasses(link.to)}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right side: Search + Auth/Avatar + Hamburger */}
        <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
          {/* Search bar (desktop) */}
          <div className="relative hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50">
              search
            </span>
            <input
              className="bg-surface-container-low border-none rounded-full pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary w-64"
              placeholder="Search brands..."
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          {/* ── Desktop: Auth Buttons OR Avatar ──────────── */}
          <div className="hidden md:flex items-center gap-4">
            {isLoggedIn ? (
              /* Authenticated — User Avatar Dropdown */
              <div className="relative" ref={avatarRef}>
                <button
                  onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                  className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
                  aria-label="User menu"
                >
                  {/* Avatar circle */}
                  <div className="w-9 h-9 rounded-full overflow-hidden shadow-sm flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full emerald-gradient flex items-center justify-center">
                        <span className="text-on-primary font-headline font-black text-sm">{initials}</span>
                      </div>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/60 text-lg">
                    {avatarMenuOpen ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {avatarMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-xl shadow-xl border border-outline-variant/10 overflow-hidden animate-slide-down z-50">
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-outline-variant/10">
                      <p className="font-headline font-bold text-sm text-on-background truncate">
                        {fullName}
                      </p>
                      <p className="text-xs text-on-surface-variant/60 truncate">
                        {userEmail}
                      </p>
                    </div>

                    {/* Menu links */}
                    <div className="py-1">
                      <Link
                        to="/profile"
                        onClick={() => setAvatarMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-headline font-bold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">dashboard</span>
                        My Dashboard
                      </Link>

                      {canAccessPartnerPortal && (
                        <Link
                          to="/partner"
                          onClick={() => setAvatarMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-headline font-bold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">storefront</span>
                          Partner Portal
                        </Link>
                      )}

                      {canAccessAdminPanel && (
                        <Link
                          to="/admin"
                          onClick={() => setAvatarMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-headline font-bold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                          Admin Panel
                        </Link>
                      )}

                      <Link
                        to="/profile?tab=saved"
                        onClick={() => setAvatarMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-headline font-bold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">bookmark</span>
                        Saved Deals
                      </Link>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-outline-variant/10 py-1">
                      <button
                        onClick={() => {
                          onLogout();
                          setAvatarMenuOpen(false);
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-headline font-bold text-error hover:bg-error/5 transition-colors w-full text-left"
                      >
                        <span className="material-symbols-outlined text-lg">logout</span>
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Not authenticated — Login & Join */
              <>
                <button
                  onClick={onOpenAuth}
                  className="text-[#323233]/60 dark:text-[#fcf9f8]/60 font-headline font-bold text-sm tracking-tight hover:text-primary transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={onOpenAuth}
                  className="emerald-gradient text-on-primary px-6 py-2 rounded-md font-headline font-bold text-sm tracking-tight shadow-sm active:opacity-80 active:scale-95 transition-all"
                >
                  Join
                </button>
              </>
            )}
          </div>

          {/* Hamburger button (mobile) */}
          <button
            className="md:hidden text-on-surface-variant"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined text-2xl">
              {mobileOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Mobile Menu ─────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden bg-[#fcf9f8]/95 dark:bg-[#323233]/95 backdrop-blur-xl border-t border-outline-variant/10 animate-slide-down">
          <div className="flex flex-col px-4 sm:px-6 py-5 gap-4">
            {/* Mobile search */}
            <div className="relative sm:hidden">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50">
                search
              </span>
              <input
                className="w-full bg-surface-container-low border-none rounded-full pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary"
                placeholder="Search brands..."
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>

            {/* Mobile nav links */}
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-base py-2 ${linkClasses(link.to)}`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile auth / user section */}
            {isLoggedIn ? (
              <div className="pt-4 border-t border-outline-variant/10 space-y-2">
                {/* User info */}
                <div className="flex items-center gap-3 py-2">
                  <div className="w-9 h-9 rounded-full overflow-hidden shadow-sm flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full emerald-gradient flex items-center justify-center">
                        <span className="text-on-primary font-headline font-black text-sm">{initials}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-headline font-bold text-sm text-on-background">{fullName}</p>
                    <p className="text-xs text-on-surface-variant/60">{userEmail}</p>
                  </div>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 py-2.5 text-sm font-headline font-bold text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">dashboard</span>
                  My Dashboard
                </Link>

                {canAccessPartnerPortal && (
                  <Link
                    to="/partner"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 py-2.5 text-sm font-headline font-bold text-on-surface-variant hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">storefront</span>
                    Partner Portal
                  </Link>
                )}

                {canAccessAdminPanel && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 py-2.5 text-sm font-headline font-bold text-on-surface-variant hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                    Admin Panel
                  </Link>
                )}

                <Link
                  to="/profile?tab=saved"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 py-2.5 text-sm font-headline font-bold text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">bookmark</span>
                  Saved Deals
                </Link>
                <button
                  onClick={() => {
                    onLogout();
                    setMobileOpen(false);
                  }}
                  className="flex items-center gap-3 py-2.5 text-sm font-headline font-bold text-error hover:text-error/80 transition-colors w-full text-left"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  Log Out
                </button>
              </div>
            ) : (
              <div className="flex gap-4 pt-4 border-t border-outline-variant/10">
                <button
                  onClick={() => {
                    onOpenAuth();
                    setMobileOpen(false);
                  }}
                  className="flex-1 py-2.5 text-sm font-headline font-bold text-on-surface-variant border border-outline-variant/20 rounded-md hover:text-primary transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    onOpenAuth();
                    setMobileOpen(false);
                  }}
                  className="flex-1 emerald-gradient text-on-primary py-2.5 rounded-md font-headline font-bold text-sm tracking-tight shadow-sm active:scale-95 transition-all"
                >
                  Join
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
