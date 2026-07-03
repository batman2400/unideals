import { useState, useCallback, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRoleContext } from "../lib/RoleContext";
import { supabase } from "../lib/supabaseClient";

function PortalLayout({ children, portalType = "partner", brandName = "" }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { role, impersonatedPartnerId, setImpersonatedPartnerId } =
    useRoleContext();
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    if (role === "admin" && portalType === "partner") {
      supabase
        .from("partner_profiles")
        .select(
          `
          user_id,
          brand_name,
          brands ( name )
        `,
        )
        .then(({ data }) => {
          if (data) {
            const partnerList = data.map((p) => {
              const brand = p.brands?.name || p.brand_name || "Unknown Brand";
              return { id: p.user_id, name: brand };
            });
            setPartners(
              partnerList.sort((a, b) => a.name.localeCompare(b.name)),
            );
          }
        });
    }
  }, [role, portalType]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const adminLinks = [
    { path: "/admin", label: "Overview", icon: "dashboard", exact: true },
    { path: "/admin/verifications", label: "Verifications", icon: "how_to_reg" },
    { path: "/admin/deals", label: "All Deals", icon: "storefront" },
    { path: "/admin/events", label: "All Events", icon: "event" },
    { path: "/admin/pending-events", label: "Pending Events", icon: "event_upcoming" },
    { path: "/admin/users", label: "Users", icon: "group" },
    { path: "/admin/brands", label: "Brands", icon: "add_business" },
    { path: "/events/new", label: "Create Event", icon: "event_available" },
    { path: "/admin/analytics", label: "Analytics", icon: "monitoring" },
  ];

  const partnerLinks = [
    { path: "/partner", label: "Overview", icon: "dashboard", exact: true },
    { path: "/partner/deals", label: "My Deals", icon: "local_offer" },
    { path: "/partner/create-deal", label: "Create Deal", icon: "add_circle" },
    { path: "/events/new", label: "Create Event", icon: "event_available" },
    { path: "/partner/scanner", label: "Scanner", icon: "qr_code_scanner" },
    { path: "/partner/analytics", label: "Analytics", icon: "monitoring" },
  ];

  const navLinks = portalType === "admin" ? adminLinks : partnerLinks;
  const portalTitle =
    portalType === "admin" ? "Admin Portal" : "Partner Portal";
  const portalIcon =
    portalType === "admin" ? "admin_panel_settings" : "handshake";

  const isActive = (link) => {
    if (link.exact) {
      return location.pathname === link.path;
    }
    return location.pathname.startsWith(link.path);
  };

  return (
    <div className="max-w-screen-2xl w-full mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl emerald-gradient flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-on-primary text-lg">
              {portalIcon}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
              {portalTitle}
            </p>
            {brandName ? (
              <p className="text-xs font-headline font-bold text-on-background truncate max-w-[180px]">
                {brandName}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={toggleSidebar}
          className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant/20 bg-surface hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-on-surface-variant text-xl">
            {sidebarOpen ? "close" : "menu"}
          </span>
        </button>
      </div>

      {/* Mobile Sidebar Dropdown */}
      {sidebarOpen && (
        <div className="lg:hidden mb-5 animate-slide-down">
          <nav className="bg-surface rounded-2xl border border-outline-variant/15 p-2 shadow-lg">
            {navLinks.map((link) => {
              const active = isActive(link);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={closeSidebar}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-headline font-bold transition-all ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-lg ${
                      active ? "text-primary" : "text-on-surface-variant"
                    }`}
                    style={active ? { fontVariationSettings: "'FILL' 1" } : {}}
                  >
                    {link.icon}
                  </span>
                  {link.label}
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}

            {role === "admin" && portalType === "partner" && (
              <div className="px-4 py-3 mt-2 border-t border-outline-variant/10">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">
                  Impersonate Brand
                </label>
                <select
                  value={impersonatedPartnerId || ""}
                  onChange={(e) =>
                    setImpersonatedPartnerId(e.target.value || null)
                  }
                  className="w-full bg-surface-container-low border border-outline-variant/30 text-xs font-bold rounded-lg px-2 py-2 text-on-background focus:ring-2 focus:ring-primary/30 outline-none"
                >
                  <option value="">-- None (Admin View) --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </nav>
        </div>
      )}

      <div className="flex gap-6 lg:gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-[240px] flex-shrink-0">
          <div className="sticky top-28">
            {/* Portal identity */}
            <div className="flex items-center gap-3 mb-6 px-2">
              <div className="w-10 h-10 rounded-xl emerald-gradient flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-on-primary text-xl">
                  {portalIcon}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
                  {portalTitle}
                </p>
                {brandName ? (
                  <p className="text-sm font-headline font-bold text-on-background truncate max-w-[160px]">
                    {brandName}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-1">
              {navLinks.map((link) => {
                const active = isActive(link);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-headline font-bold transition-all relative ${
                      active
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                    }`}
                  >
                    {/* Active indicator bar */}
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary" />
                    )}
                    <span
                      className={`material-symbols-outlined text-lg transition-colors ${
                        active
                          ? "text-primary"
                          : "text-on-surface-variant group-hover:text-on-surface"
                      }`}
                      style={
                        active ? { fontVariationSettings: "'FILL' 1" } : {}
                      }
                    >
                      {link.icon}
                    </span>
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Sidebar footer */}
            <div className="mt-8 px-2">
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
                <p className="text-[10px] font-bold tracking-[0.15em] text-on-surface-variant/60 uppercase mb-1">
                  {portalType === "admin" ? "Admin Access" : "Partner Access"}
                </p>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                  {portalType === "admin"
                    ? "Full platform control including user management and moderation."
                    : "Manage your deals, track redemptions, and scan tickets."}
                </p>

                {role === "admin" && portalType === "partner" && (
                  <div className="pt-3 border-t border-outline-variant/20">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">
                      Impersonate Brand
                    </label>
                    <select
                      value={impersonatedPartnerId || ""}
                      onChange={(e) =>
                        setImpersonatedPartnerId(e.target.value || null)
                      }
                      className="w-full bg-surface border border-outline-variant/30 text-xs font-bold rounded-lg px-2 py-2 text-on-background focus:ring-2 focus:ring-primary/30 outline-none"
                    >
                      <option value="">-- None (Admin View) --</option>
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}

export default PortalLayout;
