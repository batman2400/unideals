import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import { getPartnerBrand } from "../../lib/partnerBrand";
import PortalLayout from "../../layouts/PortalLayout";
import {
  formatDealStatusLabel,
  getDealComputedStatus,
} from "../../lib/comingSoon";

const STATUS_BADGE = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  finished: "bg-surface-container-high text-on-surface border-outline-variant/30",
  expired: "bg-surface-container-high text-on-surface border-outline-variant/30",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  paused: "bg-red-50 text-red-600 border-red-200",
};

const CATALOGUE_TABS = [
  { value: null, label: "All" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paused", label: "Paused" },
];

function PartnerDeals({ finishedOnly = false }) {
  const {
    user,
    role,
    loading: roleLoading,
    impersonatedPartnerId,
  } = useRoleContext();
  const targetUserId = impersonatedPartnerId || user?.id;
  const [partnerBrand, setPartnerBrand] = useState("");
  const [partnerBrandId, setPartnerBrandId] = useState(null);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("filter") || null);
  const [deletingDealId, setDeletingDealId] = useState(null);
  const [actingDealId, setActingDealId] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    setStatusFilter(searchParams.get("filter") || null);
  }, [searchParams]);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

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

    async function fetchDeals() {
      setLoading(true);

      const { brandId, brandName, error: brandError } =
        await getPartnerBrand(targetUserId);
      if (!active) return;
      if (brandError || !brandId) {
        setError(brandError || "No brand profile found.");
        setPartnerBrand("");
        setPartnerBrandId(null);
        setLoading(false);
        return;
      }

      setPartnerBrand(brandName);
      setPartnerBrandId(brandId);

      const { data, error: fetchError } = await supabase
        .from("deals")
        .select(
          "id, title, brand, discount, type, category, image_url, status, redemption_code, created_at, start_time, end_time",
        )
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }
      setDeals(data || []);
      setLoading(false);
    }

    fetchDeals();
    return () => {
      active = false;
    };
  }, [role, roleLoading, targetUserId, impersonatedPartnerId]);

  const handleDelete = useCallback(
    async (dealId) => {
      if (!window.confirm("Delete this deal permanently?")) return;

      setDeletingDealId(dealId);
      setError("");

      const { data, error: deleteError } = await supabase
        .from("deals")
        .delete()
        .eq("id", dealId)
        .eq("brand_id", partnerBrandId)
        .select("id");

      if (!isMountedRef.current) return;

      if (deleteError) {
        setError(deleteError.message);
        setDeletingDealId(null);
        return;
      }

      if (!data || data.length === 0) {
        setError("Delete blocked. You can only delete your own brand deals.");
        setDeletingDealId(null);
        return;
      }

      setDeals((prev) => prev.filter((d) => d.id !== dealId));
      setDeletingDealId(null);
      setMessage("Deal deleted.");
      setTimeout(() => {
        if (isMountedRef.current) setMessage("");
      }, 3000);
    },
    [partnerBrandId],
  );

  const handleStatusChange = useCallback(
    async (dealId, newStatus) => {
      if (!partnerBrandId) return;
      setActingDealId(dealId);
      setError("");

      const { error: updateError } = await supabase
        .from("deals")
        .update({ status: newStatus })
        .eq("id", dealId)
        .eq("brand_id", partnerBrandId);

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
      setMessage(
        newStatus === "paused"
          ? "Deal paused. Students will not see it until you activate it."
          : "Deal is live again.",
      );
      setTimeout(() => {
        if (isMountedRef.current) setMessage("");
      }, 3000);
    },
    [partnerBrandId],
  );

  const now = new Date();
  const catalogueDeals = deals.filter((d) => {
    const computed = getDealComputedStatus(d, now);
    return finishedOnly ? computed === "finished" : computed !== "finished";
  });

  const filteredDeals = statusFilter
    ? catalogueDeals.filter((d) => getDealComputedStatus(d, now) === statusFilter)
    : catalogueDeals;

  const sortedDeals = finishedOnly
    ? [...filteredDeals].sort((a, b) => {
        const aEnd = a.end_time ? new Date(a.end_time).getTime() : 0;
        const bEnd = b.end_time ? new Date(b.end_time).getTime() : 0;
        return bEnd - aEnd;
      })
    : filteredDeals;

  if (roleLoading || loading) {
    return (
      <PortalLayout portalType="partner" brandName="">
        <div className="space-y-5">
          <div className="h-8 w-40 rounded-xl skeleton-shimmer" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl skeleton-shimmer" />
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  if (!finishedOnly && searchParams.get("filter") === "expired") {
    return <Navigate to="/partner/finished-deals" replace />;
  }

  return (
    <PortalLayout portalType="partner" brandName={partnerBrand}>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
            {finishedOnly ? "Finished Deals" : "My Deals"}
          </h1>
          <p className="text-on-surface-variant text-sm">
            {finishedOnly
              ? `${catalogueDeals.length} ended offer${catalogueDeals.length !== 1 ? "s" : ""} for ${partnerBrand || "your brand"} — hidden from students.`
              : `${catalogueDeals.length} deal${catalogueDeals.length !== 1 ? "s" : ""} submitted for ${partnerBrand || "your brand"}.`}
          </p>
        </div>
        {!finishedOnly && (
        <Link
          to="/partner/create-deal"
          className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-5 py-2.5 rounded-xl font-headline font-bold text-sm shadow-sm hover:shadow-md transition-all"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Create Deal
        </Link>
        )}
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

      {/* Status Tabs */}
      {!finishedOnly && (
      <div className="flex bg-surface-container-low rounded-xl border border-outline-variant/15 p-1 gap-0.5 mb-6 w-fit">
        {CATALOGUE_TABS.map((tab) => {
          const count = tab.value
            ? catalogueDeals.filter(
                (d) => getDealComputedStatus(d, now) === tab.value,
              ).length
            : catalogueDeals.length;
          return (
            <button
              key={tab.label}
              onClick={() => {
                if (tab.value) {
                  setSearchParams({ filter: tab.value });
                } else {
                  setSearchParams({});
                }
              }}
              className={`px-4 py-2 rounded-lg text-xs font-headline font-bold tracking-wide transition-all flex items-center gap-1.5 ${
                statusFilter === tab.value
                  ? "bg-surface text-on-background shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab.label}
              <span className="text-[10px] font-bold opacity-60">{count}</span>
            </button>
          );
        })}
      </div>
      )}

      {/* Deal Cards */}
      {sortedDeals.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-3 block">
            local_offer
          </span>
          <p className="font-headline font-bold text-lg text-on-background mb-1">
            No deals found
          </p>
          <p className="text-on-surface-variant text-sm mb-5">
            {statusFilter
              ? "No deals with this status."
              : finishedOnly
                ? "Ended offers will appear here."
                : "Create your first deal to get started."}
          </p>
          {!finishedOnly && (
          <Link
            to="/partner/create-deal"
            className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-5 py-2.5 rounded-xl font-headline font-bold text-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">
              add_circle
            </span>
            Create Deal
          </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sortedDeals.map((deal) => {
            const isDeleting = deletingDealId === deal.id;
            const isActing = actingDealId === deal.id;
            const displayStatus = getDealComputedStatus(deal, now);
            
            const badge = STATUS_BADGE[displayStatus] || STATUS_BADGE.pending;
            const canPause =
              displayStatus === "active" || displayStatus === "scheduled";
            const canActivate = displayStatus === "paused";

            return (
              <article
                key={deal.id}
                className="bg-surface rounded-2xl border border-outline-variant/15 overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
              >
                {/* Image */}
                <div className="aspect-[16/9] bg-surface-container-low overflow-hidden relative">
                  <img
                    src={deal.image_url}
                    alt={deal.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3">
                    <span
                      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm ${badge}`}
                    >
                      {formatDealStatusLabel(displayStatus)}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className="bg-surface/80 backdrop-blur-sm text-on-surface text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-outline-variant/10">
                      {deal.type}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <p className="text-[10px] font-bold tracking-[0.12em] text-on-surface-variant/60 uppercase mb-0.5">
                    {deal.category}
                  </p>
                  <h3 className="font-headline font-bold text-base text-on-background mb-1 truncate">
                    {deal.title}
                  </h3>
                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container/25 border border-primary/10 px-2.5 py-1 mb-4">
                    <span className="text-primary text-xs font-headline font-bold">
                      {deal.discount}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {canPause && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(deal.id, "paused")}
                        disabled={isActing}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-headline font-bold text-on-surface-variant bg-surface-container-low border border-outline-variant/20 hover:bg-surface-container transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">
                          pause_circle
                        </span>
                        Pause
                      </button>
                    )}
                    {canActivate && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(deal.id, "approved")}
                        disabled={isActing}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-headline font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">
                          play_circle
                        </span>
                        Activate
                      </button>
                    )}
                    <Link
                      to={`/partner/edit-deal/${deal.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-headline font-bold text-primary bg-primary/8 border border-primary/15 hover:bg-primary/15 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">
                        edit
                      </span>
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(deal.id)}
                      disabled={isDeleting || isActing}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-headline font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <div className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-sm">
                          delete
                        </span>
                      )}
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}

export default PartnerDeals;
