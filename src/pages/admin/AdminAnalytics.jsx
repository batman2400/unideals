import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";

function AdminAnalytics() {
  const { role, loading: roleLoading } = useRoleContext();
  const [shopStats, setShopStats] = useState([]);
  const [dealStats, setDealStats] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (roleLoading || role !== "admin") return;
    let active = true;

    async function fetchAnalytics() {
      setLoading(true);

      const [shopRes, dealsRes] = await Promise.all([
        supabase.rpc("get_redemption_analytics_by_shop"),
        supabase.rpc("admin_list_all_deals", { page_limit: 1000 }),
      ]);

      if (!active) return;

      if (shopRes.error || dealsRes.error) {
        setError(
          "Analytics data unavailable. Ensure SQL migrations are applied.",
        );
        setLoading(false);
        return;
      }

      setShopStats(shopRes.data || []);
      setDealStats(dealsRes.data || []);
      setLoading(false);
    }

    fetchAnalytics();
    return () => {
      active = false;
    };
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

  // Derive unique brands
  const uniqueBrands = [
    "All Brands",
    ...new Set(shopStats.map((s) => s.brand).filter(Boolean)),
  ];

  // Filter Data
  const isGlobal = selectedBrand === "All Brands";
  const filteredDeals = isGlobal
    ? dealStats
    : dealStats.filter((d) => d.brand === selectedBrand);
  const filteredShop = isGlobal
    ? shopStats
    : shopStats.filter((s) => s.brand === selectedBrand);

  // Compute Totals
  const totals = {
    reveals: filteredDeals.reduce(
      (sum, d) => sum + Number(d.total_reveals || 0),
      0,
    ),
    tickets: filteredDeals.reduce(
      (sum, d) => sum + Number(d.total_tickets_generated || 0),
      0,
    ),
    scans: filteredShop.reduce((sum, s) => sum + Number(s.total_scans || 0), 0),
    validScans: filteredShop.reduce(
      (sum, s) => sum + Number(s.valid_scans || 0),
      0,
    ),
    failedScans: filteredShop.reduce(
      (sum, s) => sum + Number(s.failed_scans || 0),
      0,
    ),
    confirmed: filteredShop.reduce(
      (sum, s) => sum + Number(s.confirmed_redemptions || 0),
      0,
    ),
  };

  const summaryCards = [
    {
      label: "Code Reveals",
      value: totals.reveals,
      icon: "visibility",
      color: "text-on-background",
    },
    {
      label: "Tickets Generated",
      value: totals.tickets,
      icon: "confirmation_number",
      color: "text-primary",
    },
    {
      label: "Total Scans",
      value: totals.scans,
      icon: "qr_code_scanner",
      color: "text-on-background",
    },
    {
      label: "Confirmed Redemptions",
      value: totals.confirmed,
      icon: "task_alt",
      color: "text-emerald-600",
    },
  ];

  return (
    <PortalLayout portalType="admin">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
            Analytics
          </h1>
          <p className="text-on-surface-variant text-sm">
            Redemption metrics, conversion rates, and performance by brand or
            deal.
          </p>
        </div>

        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="bg-surface border border-outline-variant/30 text-on-background text-sm font-headline font-bold rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary/30 outline-none cursor-pointer min-w-[200px]"
        >
          {uniqueBrands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
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

      {/* Conversion Funnel Visual */}
      <div className="bg-surface rounded-2xl border border-outline-variant/15 p-5 md:p-6 shadow-sm mb-8">
        <h2 className="font-headline font-bold text-lg text-on-background mb-5">
          Engagement Funnel {isGlobal ? "(All Brands)" : `(${selectedBrand})`}
        </h2>
        <div className="space-y-3">
          {[
            {
              label: "Code Reveals (Online)",
              value: totals.reveals,
              pct: 100,
              color: "bg-on-surface-variant/15",
            },
            {
              label: "Tickets Generated (In-Store)",
              value: totals.tickets,
              pct:
                totals.reveals > 0
                  ? (totals.tickets / Math.max(totals.reveals, 1)) * 100
                  : totals.tickets > 0
                    ? 100
                    : 0,
              color: "bg-primary/50",
            },
            {
              label: "Partner Scans",
              value: totals.scans,
              pct:
                Math.max(totals.reveals, totals.tickets) > 0
                  ? (totals.scans /
                      Math.max(totals.reveals, totals.tickets, 1)) *
                    100
                  : totals.scans > 0
                    ? 100
                    : 0,
              color: "bg-primary/70",
            },
            {
              label: "Confirmed Redemptions",
              value: totals.confirmed,
              pct:
                totals.scans > 0
                  ? (totals.confirmed / totals.scans) * 100
                  : totals.confirmed > 0
                    ? 100
                    : 0,
              color: "emerald-gradient",
            },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-headline font-bold text-on-background">
                  {row.label}
                </span>
                <span className="text-sm font-headline font-bold text-on-surface-variant tabular-nums">
                  {row.value} ({Math.min(row.pct, 100).toFixed(1)}%)
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

      {/* Tables based on selection */}
      <div className="bg-surface rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-outline-variant/10">
          <h2 className="font-headline font-bold text-lg text-on-background">
            {isGlobal
              ? "Performance by Brand"
              : `Deal Performance: ${selectedBrand}`}
          </h2>
        </div>

        {isGlobal ? (
          /* Global View: List of Brands */
          shopStats.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant text-sm">
              No brand analytics yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full block md:table">
                <thead className="hidden md:table-header-group">
                  <tr className="border-b border-outline-variant/10 bg-surface-container-low/50 block md:table-row">
                    <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                      Brand
                    </th>
                    <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                      Total Scans
                    </th>
                    <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                      Valid
                    </th>
                    <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                      Failed
                    </th>
                    <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                      Confirmed
                    </th>
                    <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                      Conv. Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="block md:table-row-group divide-y divide-outline-variant/8">
                  {shopStats.map((row) => {
                    const rate =
                      row.total_scans > 0
                        ? (
                            (row.confirmed_redemptions / row.total_scans) *
                            100
                          ).toFixed(1)
                        : "0.0";
                    return (
                      <tr
                        key={row.brand}
                        className="block md:table-row p-4 md:p-0 hover:bg-surface-container-low/30 transition-colors border-b border-outline-variant/8 md:border-none last:border-none"
                      >
                        <td className="flex justify-between items-center md:table-cell md:text-left px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none font-headline font-bold text-sm text-on-background">
                          <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                            Brand
                          </span>
                          <span className="text-right md:text-left">
                            {row.brand}
                          </span>
                        </td>
                        <td className="flex justify-between items-center md:table-cell md:text-right px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-background tabular-nums">
                          <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                            Total Scans
                          </span>
                          <span className="text-right md:text-right">
                            {row.total_scans}
                          </span>
                        </td>
                        <td className="flex justify-between items-center md:table-cell md:text-right px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-emerald-600 font-bold tabular-nums">
                          <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                            Valid
                          </span>
                          <span className="text-right md:text-right">
                            {row.valid_scans}
                          </span>
                        </td>
                        <td className="flex justify-between items-center md:table-cell md:text-right px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-red-600 font-bold tabular-nums">
                          <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                            Failed
                          </span>
                          <span className="text-right md:text-right">
                            {row.failed_scans}
                          </span>
                        </td>
                        <td className="flex justify-between items-center md:table-cell md:text-right px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-background font-bold tabular-nums">
                          <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                            Confirmed
                          </span>
                          <span className="text-right md:text-right">
                            {row.confirmed_redemptions}
                          </span>
                        </td>
                        <td className="flex justify-between items-center md:table-cell md:text-right px-0 md:px-4 py-2 md:py-3 md:border-none text-sm text-primary font-bold tabular-nums">
                          <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                            Conv. Rate
                          </span>
                          <span className="text-right md:text-right">
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : /* Specific Brand View: List of Deals */
        filteredDeals.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">
            No deal analytics for this brand.
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
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Reveals
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
                {filteredDeals.map((d) => (
                  <tr
                    key={d.id}
                    className="block md:table-row p-4 md:p-0 hover:bg-surface-container-low/30 transition-colors border-b border-outline-variant/8 md:border-none last:border-none"
                  >
                    <td className="flex justify-between items-center md:table-cell md:text-left px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none font-headline font-bold text-sm text-on-background">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                        Deal
                      </span>
                      <span className="text-right md:text-left truncate max-w-[200px]">
                        {d.title}
                      </span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell md:text-left px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                        Status
                      </span>
                      <span
                        className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                          d.status === "approved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : d.status === "pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-600 border-red-200"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell md:text-right px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm tabular-nums">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                        Reveals
                      </span>
                      <span className="text-right md:text-right">
                        {d.total_reveals}
                      </span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell md:text-right px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm tabular-nums">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                        Tickets
                      </span>
                      <span className="text-right md:text-right">
                        {d.total_tickets_generated}
                      </span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell md:text-right px-0 md:px-4 py-2 md:py-3 md:border-none text-sm font-bold text-emerald-600 tabular-nums">
                      <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                        Redeemed
                      </span>
                      <span className="text-right md:text-right">
                        {d.total_tickets_redeemed}
                      </span>
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

export default AdminAnalytics;
