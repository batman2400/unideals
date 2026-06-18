import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";
import { useSearchParams } from "react-router-dom";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "expired", label: "Expired" },
];

const STATUS_BADGE = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  expired: "bg-surface-container-high text-on-surface-variant border-outline-variant/50",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
};

function AdminAllDeals() {
  const { role, loading: roleLoading } = useRoleContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get("filter") || "all";
  
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [actingDealId, setActingDealId] = useState(null);
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
        page_limit: 500,
        page_offset: 0,
      },
    );

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    // Parallel fetch for timing data to support dynamic time states
    const { data: timingData } = await supabase.from('deals').select('id, start_time, end_time');
    const timingMap = new Map((timingData || []).map(t => [t.id, t]));

    let processedDeals = (data || []).map(d => {
       const t = timingMap.get(d.id);
       return { ...d, start_time: t?.start_time, end_time: t?.end_time, db_status: t?.status || d.status };
    });

    const now = new Date();
    
    // Apply time-based filter locally
    if (statusFilter && statusFilter !== "all") {
      processedDeals = processedDeals.filter(d => {
         const start = d.start_time ? new Date(d.start_time) : new Date(0);
         const end = d.end_time ? new Date(d.end_time) : null;
         const st = d.db_status;
         
         let computedStatus = st;
         if (statusFilter === 'active') {
           return (st === 'active' || st === 'approved') && start <= now && (!end || end >= now);
         }
         if (statusFilter === 'scheduled') {
           return (st === 'active' || st === 'approved') && start > now;
         }
         if (statusFilter === 'expired') {
           return end && end < now;
         }
         
         return computedStatus === statusFilter;
      });
    }

    setDeals(processedDeals || []);
    setLoading(false);
  }, [role, statusFilter, searchQuery]);

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
      prev.map((d) => (d.id === dealId ? { ...d, status: newStatus } : d)),
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

  if (roleLoading || loading) {
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

  return (
    <PortalLayout portalType="admin">
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
          All Deals
        </h1>
        <p className="text-on-surface-variant text-sm">
          Full deal catalogue with status management, search, and tracking
          stats.
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or brand..."
            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-10 pr-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex bg-surface-container-low rounded-xl border border-outline-variant/15 p-1 gap-0.5">
          {STATUS_TABS.map((tab) => (
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
      </div>

      {/* Deals Table */}
      {deals.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">
            search_off
          </span>
          <p className="text-on-surface-variant text-sm">No deals found.</p>
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
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Reveals
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Tickets
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Redeemed
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group divide-y divide-outline-variant/8">
                {deals.map((deal) => {
                  const isActing = actingDealId === deal.id;
                  
                  const start = deal.start_time ? new Date(deal.start_time) : new Date(0);
                  const end = deal.end_time ? new Date(deal.end_time) : null;
                  const now = new Date();
                  
                  let displayStatus = deal.db_status || deal.status;
                  if (displayStatus === "active" || displayStatus === "approved") {
                    if (start > now) displayStatus = "scheduled";
                    else if (end && end < now) displayStatus = "expired";
                    else displayStatus = "active";
                  } else if (end && end < now) {
                    displayStatus = "expired";
                  }
                  
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
                          {displayStatus}
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
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-background font-bold md:text-right tabular-nums">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Reveals
                        </span>
                        <span>{deal.total_reveals ?? 0}</span>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-background font-bold md:text-right tabular-nums">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Tickets
                        </span>
                        <span>{deal.total_tickets_generated ?? 0}</span>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-emerald-600 font-bold md:text-right tabular-nums">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Redeemed
                        </span>
                        <span>{deal.total_tickets_redeemed ?? 0}</span>
                      </td>
                      <td className="flex justify-end items-center md:table-cell px-0 md:px-4 py-3 md:py-3 mt-2 md:mt-0">
                        <div className="flex items-center justify-end gap-1.5 w-full md:w-auto">
                          <button
                            onClick={() => handleDelete(deal.id)}
                            disabled={isActing}
                            title="Delete"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
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
        </div>
      )}
    </PortalLayout>
  );
}

export default AdminAllDeals;
