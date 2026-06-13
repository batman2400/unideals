import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";

function AdminAnalytics() {
  const { role, loading: roleLoading } = useRoleContext();
  const [shopStats, setShopStats] = useState([]);
  const [metrics, setMetrics] = useState({ totalScans: 0, validScans: 0, failedScans: 0, confirmed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (roleLoading || role !== "admin") return;
    let active = true;

    async function fetchAnalytics() {
      setLoading(true);

      const [shopRes, totalRes, validRes, confirmedRes] = await Promise.all([
        supabase.rpc("get_redemption_analytics_by_shop"),
        supabase.from("redemption_events").select("id", { count: "exact", head: true }),
        supabase.from("redemption_events").select("id", { count: "exact", head: true }).eq("scan_result", "valid"),
        supabase.from("confirmed_redemptions").select("id", { count: "exact", head: true }),
      ]);

      if (!active) return;

      if (shopRes.error || totalRes.error) {
        setError("Analytics data unavailable. Ensure SQL migrations are applied.");
        setLoading(false);
        return;
      }

      const total = totalRes.count ?? 0;
      const valid = validRes.count ?? 0;

      setShopStats(shopRes.data || []);
      setMetrics({
        totalScans: total,
        validScans: valid,
        failedScans: Math.max(total - valid, 0),
        confirmed: confirmedRes.count ?? 0,
      });
      setLoading(false);
    }

    fetchAnalytics();
    return () => { active = false; };
  }, [role, roleLoading]);

  if (roleLoading || loading) {
    return (
      <PortalLayout portalType="admin">
        <div className="space-y-5">
          <div className="h-8 w-40 rounded-xl skeleton-shimmer" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl skeleton-shimmer" />
            ))}
          </div>
          <div className="h-72 rounded-2xl skeleton-shimmer" />
        </div>
      </PortalLayout>
    );
  }

  const conversionRate = metrics.totalScans > 0
    ? ((metrics.confirmed / metrics.totalScans) * 100).toFixed(1)
    : "0.0";

  const validRate = metrics.totalScans > 0
    ? ((metrics.validScans / metrics.totalScans) * 100).toFixed(1)
    : "0.0";

  const summaryCards = [
    { label: "Total Scans", value: metrics.totalScans, icon: "qr_code_scanner", color: "text-on-background" },
    { label: "Valid Scans", value: metrics.validScans, sub: `${validRate}%`, icon: "check_circle", color: "text-emerald-600" },
    { label: "Failed Scans", value: metrics.failedScans, icon: "error", color: "text-red-600" },
    { label: "Confirmed", value: metrics.confirmed, sub: `${conversionRate}% conv.`, icon: "task_alt", color: "text-primary" },
  ];

  return (
    <PortalLayout portalType="admin">
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
          Analytics
        </h1>
        <p className="text-on-surface-variant text-sm">
          Redemption metrics, conversion rates, and per-brand performance.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-amber-700 text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="bg-surface rounded-2xl border border-outline-variant/15 p-4 md:p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[10px] md:text-[11px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">
                {card.label}
              </p>
              <span className={`material-symbols-outlined text-lg ${card.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                {card.icon}
              </span>
            </div>
            <p className={`font-headline font-black text-2xl md:text-3xl tracking-tight ${card.color}`}>
              {card.value}
            </p>
            {card.sub && (
              <p className="text-[11px] font-bold text-on-surface-variant/60 mt-1">{card.sub}</p>
            )}
          </article>
        ))}
      </div>

      {/* Conversion Funnel Visual */}
      <div className="bg-surface rounded-2xl border border-outline-variant/15 p-5 md:p-6 shadow-sm mb-8">
        <h2 className="font-headline font-bold text-lg text-on-background mb-5">
          Scan-to-Redemption Funnel
        </h2>
        <div className="space-y-3">
          {[
            { label: "Total Scans", value: metrics.totalScans, pct: 100, color: "bg-on-surface-variant/20" },
            { label: "Valid Scans", value: metrics.validScans, pct: metrics.totalScans > 0 ? (metrics.validScans / metrics.totalScans) * 100 : 0, color: "bg-primary/60" },
            { label: "Confirmed Redemptions", value: metrics.confirmed, pct: metrics.totalScans > 0 ? (metrics.confirmed / metrics.totalScans) * 100 : 0, color: "emerald-gradient" },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-headline font-bold text-on-background">{row.label}</span>
                <span className="text-sm font-headline font-bold text-on-surface-variant tabular-nums">
                  {row.value} ({row.pct.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${row.color}`}
                  style={{ width: `${Math.max(row.pct, 1)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Brand Table */}
      <div className="bg-surface rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/10">
          <h2 className="font-headline font-bold text-lg text-on-background">
            Performance by Brand
          </h2>
        </div>

        {shopStats.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-on-surface-variant text-sm">No brand analytics yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-outline-variant/10 bg-surface-container-low/50">
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Brand</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Total Scans</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Valid</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Failed</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Confirmed</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Conv. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/8">
                {shopStats.map((row) => {
                  const rate = row.total_scans > 0
                    ? ((row.confirmed_redemptions / row.total_scans) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <tr key={row.brand} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-4 py-3 font-headline font-bold text-sm text-on-background">{row.brand}</td>
                      <td className="px-4 py-3 text-sm text-right text-on-background tabular-nums">{row.total_scans}</td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-600 font-bold tabular-nums">{row.valid_scans}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600 font-bold tabular-nums">{row.failed_scans}</td>
                      <td className="px-4 py-3 text-sm text-right text-on-background font-bold tabular-nums">{row.confirmed_redemptions}</td>
                      <td className="px-4 py-3 text-sm text-right text-primary font-bold tabular-nums">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

export default AdminAnalytics;
