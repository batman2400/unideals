import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../lib/useRole";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

function PartnerDashboard() {
  const { user, role, loading: roleLoading, error: roleError } = useRole();

  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchDeals() {
      if (!active) return;

      if (roleLoading) {
        return;
      }

      if (roleError) {
        setError(roleError || "Unable to verify account role.");
        setLoading(false);
        return;
      }

      if (!user?.id) {
        setError("Unable to load partner profile.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("deals")
        .select("id, brand, title, discount, type, category, status, created_at")
        .eq("partner_id", user.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message || "Failed to load your submitted deals.");
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
  }, [roleLoading, roleError, user?.id]);

  const metrics = useMemo(() => {
    const total = deals.length;
    const approved = deals.filter((deal) => deal.status === "approved").length;
    const pending = deals.filter((deal) => deal.status === "pending").length;

    return {
      total,
      approved,
      pending,
    };
  }, [deals]);

  const metricCards = [
    {
      label: "Total Deals Submitted",
      value: metrics.total,
      icon: "summarize",
    },
    {
      label: "Active (Approved) Deals",
      value: metrics.approved,
      icon: "verified",
    },
    {
      label: "Pending Review",
      value: metrics.pending,
      icon: "hourglass_top",
    },
  ];

  if (roleLoading || loading) {
    return (
      <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16 animate-fade-in">
        <div className="min-h-[45vh] flex items-center justify-center">
          <div className="flex items-center gap-3 text-on-surface-variant">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-headline font-bold">Loading partner dashboard...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase block mb-2">
            Partner Portal
          </span>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background mb-2">
            Deal Performance Dashboard
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base max-w-2xl">
            Track your submission pipeline and monitor moderation outcomes in real time.
          </p>
        </div>

        <Link
          to="/partner/create-deal"
          className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-6 py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Create New Deal
        </Link>
      </div>

      {role !== "partner" && role !== "admin" ? (
        <div className="bg-error/10 border border-error/20 rounded-xl p-5 mb-6">
          <p className="text-error text-sm font-bold">Access denied. Partner role required.</p>
        </div>
      ) : null}

      {error ? (
        <div className="bg-error/10 border border-error/20 rounded-xl p-5 mb-6">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {metricCards.map((card) => (
              <article
                key={card.label}
                className="bg-surface rounded-2xl border border-outline-variant/20 p-5 md:p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <p className="text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase">
                    {card.label}
                  </p>
                  <span className="material-symbols-outlined text-primary text-xl">{card.icon}</span>
                </div>
                <p className="font-headline font-black text-4xl tracking-tight text-on-background">{card.value}</p>
              </article>
            ))}
          </div>

          <div className="bg-surface rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-outline-variant/10">
              <h2 className="font-headline font-extrabold text-2xl tracking-tight text-on-background">
                Your Submitted Deals
              </h2>
            </div>

            {deals.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-headline font-bold text-on-background text-lg mb-1">
                  No submissions yet
                </p>
                <p className="text-on-surface-variant text-sm">
                  Start by creating your first deal for admin review.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant/10">
                {deals.map((deal) => {
                  const badgeClass = STATUS_STYLES[deal.status] || "bg-surface-container-low text-on-surface border-outline-variant/20";

                  return (
                    <li
                      key={deal.id}
                      className="px-5 md:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div>
                        <p className="font-headline font-bold text-on-background text-base md:text-lg">
                          {deal.brand} · {deal.title}
                        </p>
                        <p className="text-on-surface-variant text-sm mt-1">
                          {deal.discount} · {deal.type} · {deal.category}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold tracking-wide uppercase ${badgeClass}`}
                        >
                          {deal.status}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default PartnerDashboard;
