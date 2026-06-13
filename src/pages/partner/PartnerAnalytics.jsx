import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import { getPartnerBrand } from "../../lib/partnerBrand";
import PortalLayout from "../../layouts/PortalLayout";

function PartnerAnalytics() {
  const { user, role, loading: roleLoading, impersonatedPartnerId } = useRoleContext();
  const targetUserId = impersonatedPartnerId || user?.id;
  const [partnerBrand, setPartnerBrand] = useState("");
  const [dealStats, setDealStats] = useState([]);
  const [totals, setTotals] = useState({
    totalScans: 0,
    confirmedRedemptions: 0,
    totalReveals: 0,
    totalTickets: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (roleLoading || !user?.id) return;
    if (role !== "partner" && role !== "admin") return;
    
    setError("");
    
    if (role === "admin" && !impersonatedPartnerId) {
      setError("Admin View: Viewing partner portal without a specific brand profile. Use the sidebar to impersonate a brand.");
      setLoading(false);
      return;
    }

    let active = true;

    async function fetchAnalytics() {
      setLoading(true);

      const { brandName, error: brandError } = await getPartnerBrand(targetUserId);
      if (!active) return;
      setPartnerBrand(brandName || "");

      // Try to use the new partner_deal_stats RPC
      const { data: statsData, error: statsError } = await supabase.rpc(
        "get_partner_deal_stats",
        { target_partner_id: targetUserId }
      );

      if (!active) return;

      if (statsError) {
        // Fallback: basic counts
        const [scansRes, confirmedRes] = await Promise.all([
          supabase.from("redemption_events").select("id", { count: "exact", head: true }).eq("partner_id", targetUserId),
          supabase.from("confirmed_redemptions").select("id", { count: "exact", head: true }).eq("partner_id", targetUserId),
        ]);

        if (!active) return;

        setTotals({
          totalScans: scansRes.count ?? 0,
          confirmedRedemptions: confirmedRes.count ?? 0,
          totalReveals: 0,
          totalTickets: 0,
        });
        setDealStats([]);
        setLoading(false);
        return;
      }

      setDealStats(statsData || []);

      // Calculate totals
      const agg = (statsData || []).reduce(
        (acc, d) => ({
          totalScans: acc.totalScans + Number(d.total_scans || 0),
          confirmedRedemptions: acc.confirmedRedemptions + Number(d.confirmed_redemptions || 0),
          totalReveals: acc.totalReveals + Number(d.total_reveals || 0),
          totalTickets: acc.totalTickets + Number(d.total_tickets_generated || 0),
        }),
        { totalScans: 0, confirmedRedemptions: 0, totalReveals: 0, totalTickets: 0 }
      );

      setTotals(agg);
      setLoading(false);
    }

    fetchAnalytics();
    return () => { active = false; };
  }, [role, roleLoading, targetUserId, impersonatedPartnerId]);

  if (roleLoading || loading) {
    return (
      <PortalLayout portalType="partner" brandName="">
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

  const summaryCards = [
    { label: "Code Reveals", value: totals.totalReveals, icon: "visibility", color: "text-on-background" },
    { label: "Tickets Generated", value: totals.totalTickets, icon: "confirmation_number", color: "text-primary" },
    { label: "Partner Scans", value: totals.totalScans, icon: "qr_code_scanner", color: "text-on-background" },
    { label: "Redemptions", value: totals.confirmedRedemptions, icon: "task_alt", color: "text-emerald-600" },
  ];

  return (
    <PortalLayout portalType="partner" brandName={partnerBrand}>
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
          Analytics
        </h1>
        <p className="text-on-surface-variant text-sm">
          Track performance across your deals — reveals, tickets, and redemptions.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
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
          </article>
        ))}
      </div>

      {/* Conversion Funnel */}
      <div className="bg-surface rounded-2xl border border-outline-variant/15 p-5 md:p-6 shadow-sm mb-8">
        <h2 className="font-headline font-bold text-lg text-on-background mb-5">
          Engagement Funnel
        </h2>
        <div className="space-y-3">
          {[
            { label: "Code Reveals (Online)", value: totals.totalReveals, pct: 100, color: "bg-on-surface-variant/15" },
            { label: "Tickets Generated (In-Store)", value: totals.totalTickets, pct: totals.totalReveals > 0 ? (totals.totalTickets / Math.max(totals.totalReveals, 1)) * 100 : (totals.totalTickets > 0 ? 100 : 0), color: "bg-primary/50" },
            { label: "Partner Scans", value: totals.totalScans, pct: Math.max(totals.totalReveals, totals.totalTickets) > 0 ? (totals.totalScans / Math.max(totals.totalReveals, totals.totalTickets, 1)) * 100 : (totals.totalScans > 0 ? 100 : 0), color: "bg-primary/70" },
            { label: "Confirmed Redemptions", value: totals.confirmedRedemptions, pct: totals.totalScans > 0 ? (totals.confirmedRedemptions / totals.totalScans) * 100 : (totals.confirmedRedemptions > 0 ? 100 : 0), color: "emerald-gradient" },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-headline font-bold text-on-background">{row.label}</span>
                <span className="text-sm font-headline font-bold text-on-surface-variant tabular-nums">{row.value}</span>
              </div>
              <div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${row.color}`}
                  style={{ width: `${Math.max(Math.min(row.pct, 100), row.value > 0 ? 3 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Deal Table */}
      <div className="bg-surface rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/10">
          <h2 className="font-headline font-bold text-lg text-on-background">
            Performance by Deal
          </h2>
        </div>

        {dealStats.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-on-surface-variant text-sm">No deal analytics yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full block md:table">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-outline-variant/10 bg-surface-container-low/50 block md:table-row">
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">Deal</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">Type</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">Status</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">Reveals</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">Copies</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">Clicks</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">Tickets</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">Redeemed</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group divide-y divide-outline-variant/8">
                {dealStats.map((d) => (
                  <tr key={d.deal_id} className="block md:table-row p-4 md:p-0 hover:bg-surface-container-low/30 transition-colors border-b border-outline-variant/8 md:border-none last:border-none">
                    <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none font-headline font-bold text-sm text-on-background">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Deal</span>
                      <span className="text-right md:text-left truncate max-w-[200px]">{d.deal_title}</span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-surface-variant">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Type</span>
                      <span className="text-right md:text-left">{d.deal_type}</span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Status</span>
                      <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                        d.deal_status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        d.deal_status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-red-50 text-red-600 border-red-200"
                      }`}>
                        {d.deal_status}
                      </span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm tabular-nums">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Reveals</span>
                      <span className="text-right md:text-right">{d.total_reveals}</span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm tabular-nums">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Copies</span>
                      <span className="text-right md:text-right">{d.total_copies}</span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm tabular-nums">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Clicks</span>
                      <span className="text-right md:text-right">{d.total_click_throughs}</span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm tabular-nums">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Tickets</span>
                      <span className="text-right md:text-right">{d.total_tickets_generated}</span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 md:border-none text-sm font-bold text-emerald-600 tabular-nums">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Redeemed</span>
                      <span className="text-right md:text-right">{d.total_tickets_redeemed}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

export default PartnerAnalytics;
