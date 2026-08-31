import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";
import {
  formatDealStatusLabel,
  getDealComputedStatus,
} from "../../lib/comingSoon";

const CATALOGUE_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paused", label: "Paused" },
];

const STATUS_BADGE = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  finished: "bg-surface-container-high text-on-surface-variant border-outline-variant/50",
  expired: "bg-surface-container-high text-on-surface-variant border-outline-variant/50",
  paused: "bg-red-50 text-red-600 border-red-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
};

const PAGE_LIMIT = 500;

function AdminAllDeals({ finishedOnly = false }) {
  const { role, loading: roleLoading } = useRoleContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter") || "all";

  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    finishedOnly ? "all" : urlFilter === "expired" ? "all" : urlFilter,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [message, setMessage] = useState("");
  const [actingDealId, setActingDealId] = useState(null);
  const [listTruncated, setListTruncated] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const fetchDeals = useCallback(async () => {
    if (role !== "admin") return;
    setLoading(true);
    setError("");

    // Fetch all deals, bypass RPC status filtering for time-based states
    const { data, error: fetchError } = await supabase.rpc(
      "admin_list_all_deals",
      {
        status_filter: null,
        search_query: searchQuery,
        page_limit: PAGE_LIMIT,
        page_offset: 0,
      },
    );

    if (fetchError) {
      setError(fetchError.message);
      setListTruncated(false);
      setLoading(false);
      return;
    }

    // Parallel fetch for timing data to support dynamic time states
    const { data: timingData, error: timingError } = await supabase
      .from("deals")
      .select("id, start_time, end_time, status");

    if (timingError) {
      console.error("Failed to load deal timing data:", timingError);
      setError(
        "Couldn't load deal schedules, so status filters may be inaccurate. Please refresh.",
      );
      setLoading(false);
      return;
    }

    const timingMap = new Map((timingData || []).map((t) => [t.id, t]));

    let processedDeals = (data || []).map((d) => {
      const t = timingMap.get(d.id);
      return {
        ...d,
        start_time: t?.start_time,
        end_time: t?.end_time,
        db_status: t?.status || d.status,
      };
    });

    processedDeals = processedDeals.filter((d) => {
      const computed = getDealComputedStatus(d);
      if (finishedOnly) return computed === "finished";
      return computed !== "finished";
    });

    if (!finishedOnly && statusFilter && statusFilter !== "all") {
      processedDeals = processedDeals.filter(
        (d) => getDealComputedStatus(d) === statusFilter,
      );
    }

    if (finishedOnly) {
      processedDeals.sort((a, b) => {
        const aEnd = a.end_time ? new Date(a.end_time).getTime() : 0;
        const bEnd = b.end_time ? new Date(b.end_time).getTime() : 0;
        return bEnd - aEnd;
      });
    }

    setDeals(processedDeals || []);
    setListTruncated((data || []).length >= PAGE_LIMIT);
    setLoading(false);
  }, [role, statusFilter, searchQuery, finishedOnly]);

  useEffect(() => {
    if (roleLoading) return;
    fetchDeals();
  }, [roleLoading, fetchDeals]);

  const handleStatusChange = useCallback(async (dealId, newStatus) => {
    setActingDealId(dealId);
    const { error: updateError } = await supabase
      .from("deals")
      .update({ status: newStatus })
      .eq("id", dealId);

    if (!isMountedRef.current) return;
    if (updateError) {
      setError(updateError.message);
      setActingDealId(null);
      return;
    }

    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, status: newStatus, db_status: newStatus } : d,
      ),
    );
    setActingDealId(null);
    setMessage(`Deal status changed to ${newStatus}.`);
    setTimeout(() => {
      if (isMountedRef.current) setMessage("");
    }, 3000);
  }, []);

  const handleDelete = useCallback(async (dealId) => {
    if (
      !window.confirm("Are you sure you want to delete this deal permanently?")
    )
      return;

    setActingDealId(dealId);
    const { error: deleteError } = await supabase
      .from("deals")
      .delete()
      .eq("id", dealId);

    if (!isMountedRef.current) return;
    if (deleteError) {
      setError(deleteError.message);
      setActingDealId(null);
      return;
    }

    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    setActingDealId(null);
    setMessage("Deal deleted permanently.");
    setTimeout(() => {
      if (isMountedRef.current) setMessage("");
    }, 3000);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue]);

  if (roleLoading) {
    return (
      <PortalLayout portalType="admin">
        <div className="space-y-5">
          <div className="h-8 w-40 rounded-xl skeleton-shimmer" />
          <div className="h-12 rounded-xl skeleton-shimmer" />
          <div className="h-96 rounded-2xl skeleton-shimmer" />
        </div>
      </PortalLayout>
    );
  }

  if (!finishedOnly && urlFilter === "expired") {
    return <Navigate to="/admin/finished-deals" replace />;
  }

  return (
    <PortalLayout portalType="admin">
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
          {finishedOnly ? "Finished Deals" : "All Deals"}
        </h1>
        <p className="text-on-surface-variant text-sm">
          {finishedOnly
            ? "Ended offers hidden from students. Newest end date first."
            : "Current catalogue with status management, search, and tracking stats."}
        </p>
      </div>

      {message && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <p className="text-emerald-700 text-sm font-bold">{message}</p>
        </div>
      )}
      {error && (
        <div className="mb-4 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">
            search
          </span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search by title or brand..."
            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-10 pr-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
        </div>

        {/* Status Tabs */}
        {!finishedOnly && (
        <div className="flex bg-surface-container-low rounded-xl border border-outline-variant/15 p-1 gap-0.5">
          {CATALOGUE_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => {
                setStatusFilter(tab.value);
                setSearchParams(tab.value === "all" ? {} : { filter: tab.value });
              }}
              className={`px-4 py-2 rounded-lg text-xs font-headline font-bold tracking-wide transition-all ${
                statusFilter === tab.value
                  ? "bg-surface text-on-background shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* Deals Table */}
      {loading ? (
        <div className="h-96 rounded-2xl skeleton-shimmer" />
      ) : deals.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">
            search_off
          </span>
          <p className="text-on-surface-variant text-sm">
            {finishedOnly ? "No finished deals." : "No deals found."}
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full block md:table">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-outline-variant/10 bg-surface-container-low/50 block md:table-row">
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Deal
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Brand
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Type
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Reveals
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Tickets
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Redeemed
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group divide-y divide-outline-variant/8">
                {deals.map((deal) => {
                  const isActing = actingDealId === deal.id;
                  const displayStatus = getDealComputedStatus(deal);
                  const badge =
                    STATUS_BADGE[displayStatus] || STATUS_BADGE.pending;

                  return (
                    <tr
                      key={deal.id}
                      className="block md:table-row p-4 md:p-0 hover:bg-surface-container-low/30 transition-colors border-b border-outline-variant/8 md:border-none last:border-none"
                    >
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Deal
                        </span>
                        <div className="flex items-center gap-3 max-w-[220px] md:max-w-none text-right md:text-left">
                          <div className="hidden md:block w-10 h-10 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0">
                            <img
                              src={deal.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-headline font-bold text-sm text-on-background truncate max-w-[150px] md:max-w-[200px]">
                              {deal.title}
                            </p>
                            <p className="text-[10px] text-on-surface-variant font-bold tracking-wider uppercase">
                              {deal.discount}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-surface-variant font-bold">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Brand
                        </span>
                        <span className="text-right md:text-left">
                          {deal.brand}
                        </span>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Status
                        </span>
                        <span
                          className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${badge}`}
                        >
                          {formatDealStatusLabel(displayStatus)}
                        </span>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-surface-variant">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Type
                        </span>
                        <span className="text-right md:text-left">
                          {deal.type}
                        </span>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-background font-bold md:text-center tabular-nums">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Reveals
                        </span>
                        {deal.type === 'In-Store' ? (
                          <span className="text-on-surface-variant/50">-</span>
                        ) : (
                          <span>{deal.total_reveals ?? 0}</span>
                        )}
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-background font-bold md:text-center tabular-nums">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Tickets
                        </span>
                        {deal.type === 'Online' ? (
                          <span className="text-on-surface-variant/50">-</span>
                        ) : (
                          <span>{deal.total_tickets_generated ?? 0}</span>
                        )}
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-emerald-600 font-bold md:text-center tabular-nums">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Redeemed
                        </span>
                        {deal.type === 'Online' ? (
                          <span className="text-on-surface-variant/50">-</span>
                        ) : (
                          <span>{deal.total_tickets_redeemed ?? 0}</span>
                        )}
                      </td>
                      <td className="flex justify-end items-center md:table-cell px-0 md:px-4 py-3 md:py-3 mt-2 md:mt-0">
                        <div className="flex items-center justify-end md:justify-center gap-1.5 w-full md:w-auto">
                          {(displayStatus === "active" || displayStatus === "scheduled") && (
                            <button
                              onClick={() => handleStatusChange(deal.id, "paused")}
                              disabled={isActing}
                              title="Pause Deal"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-lg">
                                pause_circle
                              </span>
                            </button>
                          )}
                          {displayStatus === "paused" && (
                            <button
                              onClick={() => handleStatusChange(deal.id, "approved")}
                              disabled={isActing}
                              title="Activate Deal"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-lg">
                                play_circle
                              </span>
                            </button>
                          )}
                          <div className="w-px h-5 bg-outline-variant/30 mx-1"></div>
                          <button
                            onClick={() => handleDelete(deal.id)}
                            disabled={isActing}
                            title="Delete"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-lg">
                              delete
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {listTruncated && (
            <p className="px-4 py-3 text-xs font-bold text-on-surface-variant border-t border-outline-variant/10">
              Showing first {PAGE_LIMIT} deals
            </p>
          )}
        </div>
      )}
    </PortalLayout>
  );
}

export default AdminAllDeals;
