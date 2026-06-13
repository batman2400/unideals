import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";

function AdminPendingDeals() {
  const { role, loading: roleLoading } = useRoleContext();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [actingDealId, setActingDealId] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (roleLoading || role !== "admin") return;
    let active = true;

    async function fetchPending() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("deals")
        .select(
          "id, brand, title, discount, type, category, image_url, description, created_at",
        )
        .eq("status", "pending")
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

    fetchPending();
    return () => {
      active = false;
    };
  }, [role, roleLoading]);

  const showMessage = useCallback((text, type = "success") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      if (isMountedRef.current) setMessage("");
    }, 4000);
  }, []);

  const handleAction = useCallback(
    async (id, action) => {
      setActingDealId(id);
      setError("");

      const newStatus = action === "approve" ? "approved" : "rejected";
      const { error: updateError } = await supabase
        .from("deals")
        .update({ status: newStatus })
        .eq("id", id);

      if (!isMountedRef.current) return;
      if (updateError) {
        setActingDealId(null);
        setError(updateError.message);
        return;
      }

      setDeals((prev) => prev.filter((d) => d.id !== id));
      setActingDealId(null);
      showMessage(
        action === "approve"
          ? "Deal approved and now live."
          : "Deal rejected and removed from queue.",
      );
    },
    [showMessage],
  );

  if (roleLoading || loading) {
    return (
      <PortalLayout portalType="admin">
        <div className="space-y-5">
          <div className="h-8 w-56 rounded-xl skeleton-shimmer" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl skeleton-shimmer" />
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout portalType="admin">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background">
            Pending Queue
          </h1>
          {deals.length > 0 && (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 text-amber-700 text-xs font-black">
              {deals.length}
            </span>
          )}
        </div>
        <p className="text-on-surface-variant text-sm">
          Review and moderate partner-submitted offers before they go live.
        </p>
      </div>

      {message && (
        <div
          className={`mb-5 flex items-center gap-2 rounded-xl px-4 py-3 border ${
            messageType === "error"
              ? "bg-error/10 border-error/20"
              : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <span
            className={`material-symbols-outlined text-lg ${messageType === "error" ? "text-error" : "text-emerald-600"}`}
          >
            {messageType === "error" ? "error" : "check_circle"}
          </span>
          <p
            className={`text-sm font-bold ${messageType === "error" ? "text-error" : "text-emerald-700"}`}
          >
            {message}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-5 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

      {deals.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-emerald-400 mb-3 block">
            verified
          </span>
          <p className="font-headline font-bold text-lg text-on-background mb-1">
            Queue is clear
          </p>
          <p className="text-on-surface-variant text-sm">
            No deals need moderation right now. Check back later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {deals.map((deal) => {
            const isActing = actingDealId === deal.id;
            return (
              <article
                key={deal.id}
                className="bg-surface rounded-2xl border border-outline-variant/15 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Image */}
                <div className="aspect-[16/9] bg-surface-container-low overflow-hidden relative">
                  <img
                    src={deal.image_url}
                    alt={`${deal.brand} deal`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <span className="bg-amber-100/90 backdrop-blur-sm text-amber-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-amber-200/60">
                      Pending
                    </span>
                    <span className="bg-surface/80 backdrop-blur-sm text-on-surface text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-outline-variant/10">
                      {deal.type}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <p className="text-[10px] font-bold tracking-[0.15em] text-primary uppercase mb-1">
                    {deal.category}
                  </p>
                  <h3 className="font-headline font-extrabold text-xl tracking-tight text-on-background mb-0.5">
                    {deal.title}
                  </h3>
                  <p className="text-on-surface-variant text-sm mb-3">
                    {deal.brand}
                  </p>

                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container/30 border border-primary/15 px-3 py-1.5 mb-4">
                    <span className="material-symbols-outlined text-primary text-sm">
                      local_offer
                    </span>
                    <span className="text-primary text-sm font-headline font-bold">
                      {deal.discount}
                    </span>
                  </div>

                  {deal.description && (
                    <p className="text-on-surface-variant text-xs leading-relaxed mb-4 line-clamp-2">
                      {deal.description}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAction(deal.id, "approve")}
                      disabled={isActing}
                      className="flex-1 inline-flex items-center justify-center gap-2 emerald-gradient text-on-primary py-2.5 rounded-xl font-headline font-bold text-sm shadow-sm hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                      {isActing ? (
                        <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-lg">
                          done
                        </span>
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(deal.id, "reject")}
                      disabled={isActing}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 py-2.5 rounded-xl font-headline font-bold text-sm hover:bg-red-100 active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                      {isActing ? (
                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-lg">
                          close
                        </span>
                      )}
                      Reject
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

export default AdminPendingDeals;
