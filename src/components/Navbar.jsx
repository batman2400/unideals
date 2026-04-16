/**
 * Navbar Component
 *
 * The fixed navigation bar at the top of the page.
 * Features:
 *   - Active route detection via useLocation (emerald bottom border)
 *   - Hamburger menu toggle for mobile (useState)
 *   - Search input bound to global state
 *   - Login / Join buttons trigger the AuthModal
 *
 * Props:
 *   - onOpenAuth    : function — opens the AuthModal
 *   - searchQuery   : string — current search text
 *   - onSearchChange: function — updates search text
 */
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

function Navbar({ onOpenAuth, searchQuery, onSearchChange }) {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
      <div className="flex justify-between items-center px-8 py-4 max-w-[1440px] mx-auto">
        {/* Left side: Logo + Nav Links */}
        <div className="flex items-center gap-12">
          <Link
            to="/"
            className="flex items-center gap-2"
          >
            <img src="/images/logo.png" alt="Uni Deals" className="h-8 w-auto" />
            <span className="text-2xl font-black text-[#323233] dark:text-[#fcf9f8] tracking-tighter font-headline">
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

        {/* Right side: Search + Auth Buttons + Hamburger */}
        <div className="flex items-center gap-6">
          {/* Search bar (desktop) */}
          <div className="relative hidden sm:block">
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

          {/* Auth buttons (desktop) */}
          <div className="hidden md:flex items-center gap-4">
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
          <div className="flex flex-col px-8 py-6 gap-4">
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
                className={`text-lg py-2 ${linkClasses(link.to)}`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile auth buttons */}
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
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
