import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import { getPartnerBrand } from "../../lib/partnerBrand";
import PortalLayout from "../../layouts/PortalLayout";
import {
  formatDealStatusLabel,
  getDealComputedStatus,
} from "../../lib/comingSoon";

function PartnerAnalytics() {
  const {
    user,
    role,
    loading: roleLoading,
    impersonatedPartnerId,
  } = useRoleContext();
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
    if (roleLoading || !role) return;

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

    async function fetchAnalytics() {
      setLoading(true);

      const { brandName, error: brandError } =
        await getPartnerBrand(targetUserId);
      if (!active) return;

      if (brandError) {
        console.error("Failed to resolve partner brand:", brandError);
        setError("Couldn't load your brand profile. Check your connection and try again.");
        setLoading(false);
        return;
      }

      setPartnerBrand(brandName || "");

      // Try to use the new partner_deal_stats RPC
      const { data: statsData, error: statsError } = await supabase.rpc(
        "get_partner_deal_stats",
        { target_partner_id: targetUserId },
      );

      if (!active) return;

      if (statsError) {
        // Fallback: basic counts
        const [scansRes, confirmedRes] = await Promise.all([
          supabase
            .from("redemption_events")
            .select("id", { count: "exact", head: true })
            .eq("partner_id", targetUserId),
          supabase
            .from("confirmed_redemptions")
            .select("id", { count: "exact", head: true })
            .eq("partner_id", targetUserId),
        ]);

        if (!active) return;

        const failed = [scansRes, confirmedRes].find((r) => r.error);
        if (failed) {
          console.error("Analytics fallback failed:", statsError, failed.error);
          setError("Couldn't load your analytics. Check your connection and try again.");
          setLoading(false);
          return;
        }

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
          confirmedRedemptions:
            acc.confirmedRedemptions + Number(d.confirmed_redemptions || 0),
          totalReveals: acc.totalReveals + Number(d.total_reveals || 0),
          totalTickets:
            acc.totalTickets + Number(d.total_tickets_generated || 0),
          totalCopies: acc.totalCopies + Number(d.total_copies || 0),
          totalClicks: acc.totalClicks + Number(d.total_click_throughs || 0),
        }),
        {
          totalScans: 0,
          confirmedRedemptions: 0,
          totalReveals: 0,
          totalTickets: 0,
          totalCopies: 0,
          totalClicks: 0,
        },
      );

      setTotals(agg);
      setLoading(false);
    }

    fetchAnalytics();
    return () => {
      active = false;
    };
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
    {
      label: "Code Reveals",
      value: totals.totalReveals,
      icon: "visibility",
      color: "text-on-background",
    },
    {
      label: "Tickets Generated",
      value: totals.totalTickets,
      icon: "confirmation_number",
      color: "text-primary",
    },
    {
      label: "Partner Scans",
      value: totals.totalScans,
      icon: "qr_code_scanner",
      color: "text-on-background",
    },
    {
      label: "Redemptions",
      value: totals.confirmedRedemptions,
      icon: "task_alt",
      color: "text-emerald-600",
    },
  ];

  return (
    <PortalLayout portalType="partner" brandName={partnerBrand}>
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
          Analytics
        </h1>
        <p className="text-on-surface-variant text-sm">
          Track performance across your deals — reveals, tickets, and
          redemptions.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="bg-surface rounded-2xl border border-outline-variant/15 p-4 md:p-5 shadow-sm"
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
            {
              label: "Code Reveals (Online)",
              value: totals.totalReveals,
              conversion: "",
              pct: 100,
              color: "bg-on-surface-variant/15",
            },
            {
              label: "Code Copies (Online)",
              value: totals.totalCopies || 0,
              conversion: totals.totalReveals > 0 ? `${((totals.totalCopies / totals.totalReveals) * 100).toFixed(1)}% Conv.` : "",
              pct: totals.totalReveals > 0 ? (totals.totalCopies / totals.totalReveals) * 100 : 0,
              color: "bg-primary/50",
            },
            {
              label: "Tickets Generated (In-Store)",
              value: totals.totalTickets,
              conversion: "",
              pct: 100,
              color: "bg-on-surface-variant/15",
            },
            {
              label: "Confirmed Redemptions (In-Store)",
              value: totals.confirmedRedemptions,
              conversion: totals.totalTickets > 0 ? `${((totals.confirmedRedemptions / totals.totalTickets) * 100).toFixed(1)}% Conv.` : "",
              pct: totals.totalTickets > 0 ? (totals.confirmedRedemptions / totals.totalTickets) * 100 : 0,
              color: "emerald-gradient",
            },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-headline font-bold text-on-background flex items-center gap-2">
                  {row.label}
                  {row.conversion && (
                    <span className="text-[10px] font-bold tracking-wider uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      {row.conversion}
                    </span>
                  )}
                </span>
                <span className="text-sm font-headline font-bold text-on-surface-variant tabular-nums">
                  {row.value}
                </span>
              </div>
              <div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${row.color}`}
                  style={{
                    width: `${Math.max(Math.min(row.pct, 100), row.value > 0 ? 3 : 0)}%`,
                  }}
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
            <p className="text-on-surface-variant text-sm">
              No deal analytics yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full block md:table">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-outline-variant/10 bg-surface-container-low/50 block md:table-row">
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Deal
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Reveals
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Copies
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Clicks
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Tickets
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Redeemed
                  </th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group divide-y divide-outline-variant/8">
                {dealStats.map((d) => {
                  const displayStatus = getDealComputedStatus({
                    ...d,
                    status: d.deal_status,
                  });
                  let pillClass = "bg-surface-container-high text-on-surface border-outline-variant/30";
                  if (displayStatus === "active") pillClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  else if (displayStatus === "scheduled") pillClass = "bg-blue-50 text-blue-700 border-blue-200";
                  else if (displayStatus === "paused") pillClass = "bg-red-50 text-red-600 border-red-200";
                  else if (displayStatus === "finished") pillClass = "bg-surface-container-high text-on-surface-variant border-outline-variant/50";

                  const isOnline = d.deal_type === "Online";
                  const isInStore = d.deal_type === "In-Store";

                  return (
                  <tr
                    key={d.deal_id}
                    className="block md:table-row p-4 md:p-0 hover:bg-surface-container-low/30 transition-colors border-b border-outline-variant/8 md:border-none last:border-none"
                  >
                    {/* Desktop View */}
                    <td className="hidden md:table-cell px-4 py-3 font-headline font-bold text-sm text-on-background max-w-[200px] truncate">
                      {d.deal_title}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-sm text-on-surface-variant">
                      {d.deal_type}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${pillClass}`}>
                        {formatDealStatusLabel(displayStatus)}
                      </span>
                    </td>
                    <td className="hidden md:table-cell text-right px-4 py-3 text-sm tabular-nums text-on-surface-variant">
                      {isOnline ? d.total_reveals : "-"}
                    </td>
                    <td className="hidden md:table-cell text-right px-4 py-3 text-sm tabular-nums text-on-surface-variant">
                      {isOnline ? d.total_copies : "-"}
                    </td>
                    <td className="hidden md:table-cell text-right px-4 py-3 text-sm tabular-nums text-on-surface-variant">
                      {isOnline ? d.total_click_throughs : "-"}
                    </td>
                    <td className="hidden md:table-cell text-right px-4 py-3 text-sm tabular-nums text-on-surface-variant">
                      {isInStore ? d.total_tickets_generated : "-"}
                    </td>
                    <td className="hidden md:table-cell text-right px-4 py-3 text-sm font-bold text-emerald-600 tabular-nums">
                      {isInStore ? d.confirmed_redemptions : "-"}
                    </td>

                    {/* Mobile View Card */}
                    <td className="md:hidden block w-full">
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-headline font-bold text-base text-on-background truncate">
                              {d.deal_title}
                            </h3>
                            <p className="text-xs font-bold text-on-surface-variant mt-0.5">
                              {d.deal_type}
                            </p>
                          </div>
                          <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase whitespace-nowrap ${pillClass}`}>
                            {formatDealStatusLabel(displayStatus)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mt-1 bg-surface-container-low/50 rounded-xl p-3 border border-outline-variant/10">
                          {isOnline && (
                            <>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold tracking-[0.12em] text-on-surface-variant/80 uppercase mb-1">Reveals</span>
                                <span className="text-sm font-headline font-bold text-on-background tabular-nums">{d.total_reveals}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold tracking-[0.12em] text-on-surface-variant/80 uppercase mb-1">Copies</span>
                                <span className="text-sm font-headline font-bold text-on-background tabular-nums">{d.total_copies}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold tracking-[0.12em] text-on-surface-variant/80 uppercase mb-1">Clicks</span>
                                <span className="text-sm font-headline font-bold text-on-background tabular-nums">{d.total_click_throughs}</span>
                              </div>
                            </>
                          )}
                          {isInStore && (
                            <>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold tracking-[0.12em] text-on-surface-variant/80 uppercase mb-1">Tickets</span>
                                <span className="text-sm font-headline font-bold text-on-background tabular-nums">{d.total_tickets_generated}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold tracking-[0.12em] text-on-surface-variant/80 uppercase mb-1">Redeemed</span>
                                <span className="text-sm font-headline font-bold text-emerald-600 tabular-nums">{d.confirmed_redemptions}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
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

export default PartnerAnalytics;
