import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";

const STATUS_TABS = [
  { value: null, label: "All" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_BADGE = {
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
};

function AdminAllDeals() {
  const { role, loading: roleLoading } = useRoleContext();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [actingDealId, setActingDealId] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  const fetchDeals = useCallback(async () => {
    if (role !== "admin") return;
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase.rpc("admin_list_all_deals", {
      status_filter: statusFilter,
      search_query: searchQuery,
      page_limit: 100,
      page_offset: 0,
    });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setDeals(data || []);
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
      prev.map((d) => (d.id === dealId ? { ...d, status: newStatus } : d))
    );
    setActingDealId(null);
    setMessage(`Deal status changed to ${newStatus}.`);
    setTimeout(() => { if (isMountedRef.current) setMessage(""); }, 3000);
  }, []);

  const handleDelete = useCallback(async (dealId) => {
    if (!window.confirm("Are you sure you want to delete this deal permanently?")) return;

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
    setTimeout(() => { if (isMountedRef.current) setMessage(""); }, 3000);
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
          Full deal catalogue with status management, search, and tracking stats.
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
              onClick={() => setStatusFilter(tab.value)}
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
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-outline-variant/10 bg-surface-container-low/50">
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Deal</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Brand</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Type</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Reveals</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Tickets</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Redeemed</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/8">
                {deals.map((deal) => {
                  const isActing = actingDealId === deal.id;
                  const badge = STATUS_BADGE[deal.status] || STATUS_BADGE.pending;

                  return (
                    <tr key={deal.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0">
                            <img src={deal.image_url} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-headline font-bold text-sm text-on-background truncate max-w-[200px]">
                              {deal.title}
                            </p>
                            <p className="text-[10px] text-on-surface-variant font-bold tracking-wider uppercase">
                              {deal.discount}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant font-bold">{deal.brand}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${badge}`}>
                          {deal.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant">{deal.type}</td>
                      <td className="px-4 py-3 text-sm text-right text-on-background font-bold tabular-nums">
                        {deal.total_reveals ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-on-background font-bold tabular-nums">
                        {deal.total_tickets_generated ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-600 font-bold tabular-nums">
                        {deal.total_tickets_redeemed ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {deal.status !== "approved" && (
                            <button
                              onClick={() => handleStatusChange(deal.id, "approved")}
                              disabled={isActing}
                              title="Approve"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-lg">check_circle</span>
                            </button>
                          )}
                          {deal.status !== "rejected" && (
                            <button
                              onClick={() => handleStatusChange(deal.id, "rejected")}
                              disabled={isActing}
                              title="Reject"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-lg">block</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(deal.id)}
                            disabled={isActing}
                            title="Delete"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
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
