import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import { getPartnerBrand } from "../../lib/partnerBrand";
import PortalLayout from "../../layouts/PortalLayout";
import { getDealComputedStatus } from "../../lib/comingSoon";

function PartnerOverview() {
  const {
    user,
    role,
    loading: roleLoading,
    impersonatedPartnerId,
  } = useRoleContext();
  const targetUserId = impersonatedPartnerId || user?.id;
  const [partnerBrand, setPartnerBrand] = useState("");
  const [deals, setDeals] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [stats, setStats] = useState({
    totalScans: 0,
    confirmedRedemptions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (roleLoading) return;

    if (!user?.id || (role !== "partner" && role !== "admin")) {
      setError("You don't have access to the partner portal.");
      setLoading(false);
      return;
    }

    setError("");

    if (role === "admin" && !impersonatedPartnerId) {
      setError(
        "Admin View: Viewing partner portal without a specific brand profile. Use the sidebar to impersonate a brand.",
      );
      setLoading(false);
      return;
    }

    let active = true;

    async function fetchData() {
      setLoading(true);

      const { brandId, brandName, error: brandError } =
        await getPartnerBrand(targetUserId);
      if (!active) return;
      if (brandError || !brandId) {
        setError(
          brandError ||
            "No brand profile found. Create your first deal to set up your brand.",
        );
        setLoading(false);
        return;
      }

      setPartnerBrand(brandName);

      const [dealsRes, scansRes, confirmedRes, eventsRes] = await Promise.all([
        supabase
          .from("deals")
          .select("id, title, discount, type, category, status, created_at, start_time, end_time")
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false }),
        supabase
          .from("redemption_events")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", targetUserId),
        supabase
          .from("confirmed_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", targetUserId),
        supabase
          .from("redemption_events")
          .select("id, scanned_code, scan_result, scan_method, created_at")
          .eq("partner_id", targetUserId)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      if (!active) return;

      const failed = [dealsRes, scansRes, confirmedRes, eventsRes].find((r) => r.error);
      if (failed) {
        console.error("Failed to load partner overview:", failed.error);
        setError("Couldn't load your dashboard. Check your connection and try again.");
        setLoading(false);
        return;
      }

      setDeals(dealsRes.data || []);
      setStats({
        totalScans: scansRes.count ?? 0,
        confirmedRedemptions: confirmedRes.count ?? 0,
      });
      setRecentEvents(eventsRes.data || []);
      setLoading(false);
    }

    fetchData();
    return () => {
      active = false;
    };
  }, [role, roleLoading, targetUserId, impersonatedPartnerId]);

  const metrics = useMemo(() => {
    const now = new Date();
    let current = 0;
    let active = 0;
    let scheduled = 0;
    let expired = 0;
    for (const d of deals) {
      const computed = getDealComputedStatus(d, now);
      if (computed === "finished") expired++;
      else {
        current++;
        if (computed === "active") active++;
        else if (computed === "scheduled") scheduled++;
      }
    }
    return { total: current, active, scheduled, expired };
  }, [deals]);

  if (roleLoading || loading) {
    return (
      <PortalLayout portalType="partner" brandName="">
        <div className="space-y-5">
          <div className="h-8 w-48 rounded-xl skeleton-shimmer" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl skeleton-shimmer" />
            ))}
          </div>
          <div className="h-64 rounded-2xl skeleton-shimmer" />
        </div>
      </PortalLayout>
    );
  }

  const metricCards = [
    {
      label: "Total Deals",
      value: metrics.total,
      icon: "inventory_2",
      color: "text-on-background",
      to: "/partner/deals",
    },
    {
      label: "Active Deals",
      value: metrics.active,
      icon: "check_circle",
      color: "text-emerald-600",
      to: "/partner/deals?filter=active",
    },
    {
      label: "Scheduled",
      value: metrics.scheduled,
      icon: "schedule",
      color: "text-blue-600",
      to: "/partner/deals?filter=scheduled",
    },
    {
      label: "Finished Deals",
      value: metrics.expired,
      icon: "history",
      color: "text-on-surface-variant",
      to: "/partner/finished-deals",
    },
    {
      label: "Redemptions",
      value: stats.confirmedRedemptions,
      icon: "task_alt",
      color: "text-primary",
      to: "/partner/analytics",
    },
  ];

  const scanResultColor = {
    valid: "text-emerald-600 bg-emerald-50 border-emerald-200",
    not_found: "text-red-600 bg-red-50 border-red-200",
    wrong_brand: "text-red-600 bg-red-50 border-red-200",
    not_approved: "text-amber-600 bg-amber-50 border-amber-200",
    invalid: "text-red-600 bg-red-50 border-red-200",
  };

  return (
    <PortalLayout portalType="partner" brandName={partnerBrand}>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
            Dashboard
          </h1>
          <p className="text-on-surface-variant text-sm">
            {partnerBrand
              ? `Overview for ${partnerBrand} — deals, scans, and redemptions.`
              : "Set up your brand by creating your first deal."}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {metricCards.map((card) => (
          <Link
            to={card.to}
            key={card.label}
            className="block bg-surface rounded-2xl border border-outline-variant/15 p-4 md:p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[10px] md:text-[11px] font-bold tracking-[0.12em] text-on-surface-variant uppercase group-hover:text-primary transition-colors">
                {card.label}
              </p>
              <span
                className={`material-symbols-outlined text-lg ${card.color}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {card.icon}
              </span>
            </div>
            <p
              className={`font-headline font-black text-2xl md:text-3xl tracking-tight ${card.color}`}
            >
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick Links + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Quick Links */}
        <div className="xl:col-span-1 bg-surface rounded-2xl border border-outline-variant/15 p-5 shadow-sm">
          <h2 className="font-headline font-bold text-lg text-on-background mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {[
              {
                to: "/profile",
                icon: "manage_accounts",
                label: "Manage Profile",
                desc: "Update settings",
              },
              {
                to: "/partner/create-deal",
                icon: "add_circle",
                label: "Create Deal",
                desc: "Submit new offer",
              },
              {
                to: "/partner/scanner",
                icon: "qr_code_scanner",
                label: "Scanner",
                desc: "Scan tickets",
              },
              {
                to: "/partner/analytics",
                icon: "monitoring",
                label: "Analytics",
                desc: "View performance",
              },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-3 p-4 rounded-xl border border-outline-variant/10 bg-surface-container-low/50 hover:bg-surface-container-low hover:border-primary/15 transition-all group"
              >
                <span className="material-symbols-outlined text-xl text-on-surface-variant group-hover:text-primary transition-colors">
                  {link.icon}
                </span>
                <div>
                  <p className="font-headline font-bold text-sm text-on-background">
                    {link.label}
                  </p>
                  <p className="text-[10px] text-on-surface-variant">
                    {link.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="xl:col-span-2 w-full bg-surface rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10">
            <h2 className="font-headline font-bold text-lg text-on-background">
              Recent Scans
            </h2>
          </div>

          {recentEvents.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-2 block">
                qr_code_scanner
              </span>
              <p className="text-on-surface-variant text-sm">
                No scan activity yet.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/8">
              {recentEvents.map((event) => (
                <li
                  key={event.id}
                  className="px-4 md:px-5 py-3 md:py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-background truncate">
                      {event.scanned_code || "—"}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      {event.scan_method} ·{" "}
                      {new Date(event.created_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                    <span
                      className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${scanResultColor[event.scan_result] || scanResultColor.invalid}`}
                    >
                      {event.scan_result}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}

export default PartnerOverview;
