import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";
import { Link } from "react-router-dom";

function AdminOverview() {
  const { role, loading: roleLoading } = useRoleContext();
  const [metrics, setMetrics] = useState({
    totalDeals: 0,
    activeDeals: 0,
    scheduledDeals: 0,
    expiredDeals: 0,
    totalUsers: 0,
    totalPartners: 0,
    pendingVerifications: 0,
    confirmedRedemptions: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (roleLoading || role !== "admin") return;

    let active = true;

    async function fetchOverview() {
      setLoading(true);
      setError("");

      try {
        const [
          dealsRes,
          usersRes,
          partnersRes,
          verificationsRes,
          confirmedRes,
          recentEventsRes,
        ] = await Promise.all([
          supabase
            .from("deals")
            .select("id, status, start_time, end_time"),
          supabase.rpc("list_users_with_roles", {
            search_query: "",
            role_filter: null,
            page_limit: 1,
            page_offset: 0,
          }),
          supabase.rpc("list_users_with_roles", {
            search_query: "",
            role_filter: "partner",
            page_limit: 1,
            page_offset: 0,
          }),
          supabase
            .from("manual_verifications")
            .select("id", { count: "exact", head: true })
            .in("status", ["pending", "awaiting_confirmation"]),
          supabase
            .from("confirmed_redemptions")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("redemption_events")
            .select(
              "id, brand, scanned_code, scan_result, scan_method, created_at, deals(title)"
            )
            .eq("scan_result", "valid")
            .order("created_at", { ascending: false })
            .limit(8),
        ]);

        if (!active) return;

        // Supabase reports failures on the response object rather than
        // throwing, so without this the dashboard renders confident zeros.
        const failed = [
          dealsRes,
          usersRes,
          partnersRes,
          verificationsRes,
          confirmedRes,
          recentEventsRes,
        ].find((r) => r.error);

        if (failed) {
          console.error("Failed to load admin overview:", failed.error);
          setError("Couldn't load platform metrics. Check your connection and try again.");
          return;
        }

        let activeDeals = 0;
        let scheduledDeals = 0;
        let expiredDeals = 0;
        const now = new Date();

        (dealsRes.data || []).forEach(d => {
           const start = d.start_time ? new Date(d.start_time) : new Date(0);
           const end = d.end_time ? new Date(d.end_time) : null;
           let st = d.status;
           if (st === "active" || st === "approved") {
             if (start > now) scheduledDeals++;
             else if (end && end < now) expiredDeals++;
             else activeDeals++;
           } else if (end && end < now) {
             expiredDeals++;
           }
        });

        const totalUsers = usersRes.data?.[0]?.total_count ?? 0;
        const totalPartners = partnersRes.data?.[0]?.total_count ?? 0;

        setMetrics({
          totalDeals: (dealsRes.data || []).length,
          activeDeals,
          scheduledDeals,
          expiredDeals,
          totalUsers: Number(totalUsers),
          totalPartners: Number(totalPartners),
          pendingVerifications: verificationsRes.count ?? 0,
          confirmedRedemptions: confirmedRes.count ?? 0,
        });
        setRecentActivity(recentEventsRes.data || []);
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Failed to load overview data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchOverview();
    return () => {
      active = false;
    };
  }, [role, roleLoading]);

  if (roleLoading || loading) {
    return (
      <PortalLayout portalType="admin">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="h-8 w-48 rounded-xl skeleton-shimmer" />
            <div className="h-5 w-80 rounded-lg skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl skeleton-shimmer" />
            ))}
          </div>
          <div className="h-64 rounded-2xl skeleton-shimmer" />
        </div>
      </PortalLayout>
    );
  }

  if (role !== "admin") {
    return (
      <PortalLayout portalType="admin">
        <div className="bg-error/10 border border-error/20 rounded-2xl p-6">
          <p className="text-error font-headline font-bold">
            Access denied. Admin role required.
          </p>
        </div>
      </PortalLayout>
    );
  }

  const metricCards = [
    {
      label: "Total Deals",
      value: metrics.totalDeals,
      icon: "inventory_2",
      color: "text-on-background",
      path: "/admin/deals",
    },
    {
      label: "Active Deals",
      value: metrics.activeDeals,
      icon: "check_circle",
      color: "text-emerald-600",
      path: "/admin/deals?filter=active",
    },
    {
      label: "Scheduled Deals",
      value: metrics.scheduledDeals,
      icon: "schedule",
      color: "text-blue-600",
      path: "/admin/deals?filter=scheduled",
    },
    {
      label: "Expired Deals",
      value: metrics.expiredDeals,
      icon: "history",
      color: "text-on-surface-variant",
      path: "/admin/deals?filter=expired",
    },
    {
      label: "Total Users",
      value: metrics.totalUsers,
      icon: "group",
      color: "text-on-background",
      path: "/admin/users",
    },
    {
      label: "Partners",
      value: metrics.totalPartners,
      icon: "handshake",
      color: "text-primary",
      path: "/admin/brands",
    },
    {
      label: "Pending Verifications",
      value: metrics.pendingVerifications,
      icon: "admin_panel_settings",
      color: "text-amber-600",
      path: "/admin/verifications",
    },
    {
      label: "Redemptions",
      value: metrics.confirmedRedemptions,
      icon: "task_alt",
      color: "text-emerald-600",
      path: "/admin/analytics",
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
    <PortalLayout portalType="admin">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
          Dashboard Overview
        </h1>
        <p className="text-on-surface-variant text-sm">
          Platform health at a glance — deals, users, and redemption activity.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {metricCards.map((card) => (
          <Link
            to={card.path}
            key={card.label}
            className="block bg-surface rounded-2xl border border-outline-variant/15 p-4 md:p-5 shadow-sm hover:shadow-md hover:border-primary/50 hover:-translate-y-1 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[10px] md:text-[11px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">
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

      {/* Recent Activity */}
      <div className="w-full bg-surface rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/10">
          <h2 className="font-headline font-bold text-lg text-on-background">
            Recent Scan Activity
          </h2>
        </div>

        {recentActivity.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">
              qr_code_scanner
            </span>
            <p className="text-on-surface-variant text-sm">
              No scan activity yet.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant/8">
            {recentActivity.map((event) => (
              <li
                key={event.id}
                className="px-4 md:px-5 py-3 md:py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 hover:bg-surface-container-low/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-bold text-sm text-on-background truncate">
                    {event.deals?.title || event.brand}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {event.brand} · Code: {event.scanned_code || "—"} · {event.scan_method}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                  <span
                    className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${scanResultColor[event.scan_result] || scanResultColor.invalid}`}
                  >
                    {event.scan_result}
                  </span>
                  <p className="text-xs text-on-surface-variant/60 whitespace-nowrap">
                    {new Date(event.created_at).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalLayout>
  );
}

export default AdminOverview;
