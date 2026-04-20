import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../lib/useRole";

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortId(value) {
  const text = String(value || "");
  if (!text) return "-";
  return `${text.slice(0, 8)}...`;
}

function AdminDashboard() {
  const { role, loading: roleLoading, error: roleError } = useRole();

  const [pendingDeals, setPendingDeals] = useState([]);
  const [scanEvents, setScanEvents] = useState([]);
  const [confirmedRedemptions, setConfirmedRedemptions] = useState([]);
  const [analyticsWarning, setAnalyticsWarning] = useState("");
  const [analyticsMetrics, setAnalyticsMetrics] = useState({
    totalScans: 0,
    validScans: 0,
    failedScans: 0,
    confirmedRedemptions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [actingDealId, setActingDealId] = useState(null);
  const [partnerForm, setPartnerForm] = useState({ email: "", brandName: "" });
  const [promoting, setPromoting] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchDashboardData() {
      if (!active) return;

      if (roleLoading) {
        return;
      }

      if (roleError) {
        setError(roleError || "Unable to verify role.");
        setLoading(false);
        return;
      }

      if (role !== "admin") {
        setError("Access denied. Admin role is required.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setAnalyticsWarning("");

      const { data: pendingData, error: pendingError } = await supabase
        .from("deals")
        .select("id, brand, title, discount, type, category, image_url, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!active) return;

      if (pendingError) {
        setError(pendingError.message || "Failed to load pending deals.");
        setLoading(false);
        return;
      }

      setPendingDeals(pendingData || []);

      const [eventsResponse, confirmedResponse, totalScansResponse, validScansResponse] = await Promise.all([
        supabase
          .from("redemption_events")
          .select("id, partner_id, deal_id, brand, scanned_code, scan_method, scan_result, created_at")
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("confirmed_redemptions")
          .select("id, partner_id, deal_id, brand, redemption_code, created_at", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("redemption_events")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("redemption_events")
          .select("id", { count: "exact", head: true })
          .eq("scan_result", "valid"),
      ]);

      if (!active) return;

      const analyticsError =
        eventsResponse.error
        || confirmedResponse.error
        || totalScansResponse.error
        || validScansResponse.error;

      if (analyticsError) {
        setAnalyticsWarning(
          "Redemption analytics are unavailable. Run the latest SQL migration to enable scan tracking tables."
        );
        setScanEvents([]);
        setConfirmedRedemptions([]);
        setAnalyticsMetrics({
          totalScans: 0,
          validScans: 0,
          failedScans: 0,
          confirmedRedemptions: 0,
        });
        setLoading(false);
        return;
      }

      const totalScans = totalScansResponse.count ?? 0;
      const validScans = validScansResponse.count ?? 0;
      const totalConfirmedRedemptions = confirmedResponse.count ?? 0;

      setScanEvents(eventsResponse.data || []);
      setConfirmedRedemptions(confirmedResponse.data || []);
      setAnalyticsMetrics({
        totalScans,
        validScans,
        failedScans: Math.max(totalScans - validScans, 0),
        confirmedRedemptions: totalConfirmedRedemptions,
      });
      setLoading(false);
    }

    fetchDashboardData();

    return () => {
      active = false;
    };
  }, [role, roleError, roleLoading]);

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  const handleApprove = async (id) => {
    if (role !== "admin") {
      showMessage("Only admins can approve deals.", "error");
      return;
    }

    setActingDealId(id);
    setError("");

    const { error: updateError } = await supabase
      .from("deals")
      .update({ status: "approved" })
      .eq("id", id);

    if (!isMountedRef.current) return;

    if (updateError) {
      setActingDealId(null);
      setError(updateError.message || "Failed to approve deal.");
      return;
    }

    setPendingDeals((prev) => prev.filter((deal) => deal.id !== id));
    setActingDealId(null);
    showMessage("Deal approved and moved out of the pending queue.", "success");
  };

  const handleReject = async (id) => {
    if (role !== "admin") {
      showMessage("Only admins can reject deals.", "error");
      return;
    }

    setActingDealId(id);
    setError("");

    const { error: updateError } = await supabase
      .from("deals")
      .update({ status: "rejected" })
      .eq("id", id);

    if (!isMountedRef.current) return;

    if (updateError) {
      setActingDealId(null);
      setError(updateError.message || "Failed to reject deal.");
      return;
    }

    setPendingDeals((prev) => prev.filter((deal) => deal.id !== id));
    setActingDealId(null);
    showMessage("Deal rejected and removed from moderation queue.", "success");
  };

  const handlePartnerFormChange = (event) => {
    const { name, value } = event.target;
    setPartnerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePromoteToPartner = async (event) => {
    event.preventDefault();

    if (role !== "admin") {
      showMessage("Only admins can promote users to partner.", "error");
      return;
    }

    const email = partnerForm.email.trim().toLowerCase();
    const brandName = partnerForm.brandName.trim();

    if (!email || !brandName) {
      showMessage("Email and brand name are required.", "error");
      return;
    }

    setPromoting(true);
    setError("");

    const { data, error: promoteError } = await supabase.rpc("promote_user_to_partner", {
      target_email: email,
      target_brand: brandName,
    });

    if (!isMountedRef.current) return;

    if (promoteError) {
      setPromoting(false);
      showMessage(promoteError.message || "Could not promote user to partner.", "error");
      return;
    }

    setPromoting(false);
    setPartnerForm({ email: "", brandName: "" });
    showMessage(`User ${email} is now a partner for ${brandName}.`, "success");

    if (data) {
      console.log("[AdminDashboard] promote_user_to_partner result user_id:", data);
    }
  };

  if (roleLoading || loading) {
    return (
      <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16 animate-fade-in">
        <div className="min-h-[45vh] flex items-center justify-center">
          <div className="flex items-center gap-3 text-on-surface-variant">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-headline font-bold">Loading moderation queue...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16 animate-fade-in">
      <div className="mb-8">
        <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase block mb-2">
          Admin Moderation
        </span>
        <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background mb-2">
          Pending Deal Queue
        </h1>
        <p className="text-on-surface-variant text-sm md:text-base max-w-2xl">
          Review newly submitted partner offers and decide which deals go live.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 flex items-start gap-2 rounded-lg px-4 py-3 border ${
            messageType === "error"
              ? "bg-error/10 border-error/20"
              : "bg-primary-container/30 border-primary/20"
          }`}
        >
          <span
            className={`material-symbols-outlined text-lg flex-shrink-0 mt-0.5 ${
              messageType === "error" ? "text-error" : "text-primary"
            }`}
          >
            {messageType === "error" ? "error" : "check_circle"}
          </span>
          <p className={`text-sm font-bold ${messageType === "error" ? "text-error" : "text-primary"}`}>
            {message}
          </p>
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-outline-variant/20 p-5 md:p-6 mb-8 shadow-sm">
        <div className="mb-5">
          <h2 className="font-headline font-extrabold text-2xl tracking-tight text-on-background mb-1">
            Partner Access Management
          </h2>
          <p className="text-on-surface-variant text-sm">
            Promote a signed-up user to partner and assign their one allowed brand.
          </p>
        </div>

        <form onSubmit={handlePromoteToPartner} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
              User Email
            </label>
            <input
              name="email"
              type="email"
              value={partnerForm.email}
              onChange={handlePartnerFormChange}
              disabled={promoting}
              placeholder="user@domain.com"
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
              Brand Name
            </label>
            <input
              name="brandName"
              type="text"
              value={partnerForm.brandName}
              onChange={handlePartnerFormChange}
              disabled={promoting}
              placeholder="TechNova"
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="md:col-span-1 flex items-end">
            <button
              type="submit"
              disabled={promoting}
              className="w-full inline-flex items-center justify-center gap-2 emerald-gradient text-on-primary py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {promoting ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  Promoting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">person_add</span>
                  Promote To Partner
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-surface rounded-2xl border border-outline-variant/20 p-5 md:p-6 mb-8 shadow-sm">
        <div className="mb-5">
          <h2 className="font-headline font-extrabold text-2xl tracking-tight text-on-background mb-1">
            Redemption Analytics
          </h2>
          <p className="text-on-surface-variant text-sm">
            View recent partner scanner activity and confirmed redemptions.
          </p>
        </div>

        {analyticsWarning ? (
          <div className="mb-5 bg-amber-100 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-amber-700 text-sm font-bold">{analyticsWarning}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <article className="bg-surface-container-low rounded-xl border border-outline-variant/15 p-4">
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-on-surface-variant mb-2">Total Scans</p>
            <p className="font-headline font-black text-3xl tracking-tight text-on-background">{analyticsMetrics.totalScans}</p>
          </article>

          <article className="bg-surface-container-low rounded-xl border border-outline-variant/15 p-4">
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-on-surface-variant mb-2">Valid Scans</p>
            <p className="font-headline font-black text-3xl tracking-tight text-emerald-700">{analyticsMetrics.validScans}</p>
          </article>

          <article className="bg-surface-container-low rounded-xl border border-outline-variant/15 p-4">
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-on-surface-variant mb-2">Failed Scans</p>
            <p className="font-headline font-black text-3xl tracking-tight text-red-700">{analyticsMetrics.failedScans}</p>
          </article>

          <article className="bg-surface-container-low rounded-xl border border-outline-variant/15 p-4">
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-on-surface-variant mb-2">Confirmed Redemptions</p>
            <p className="font-headline font-black text-3xl tracking-tight text-on-background">{analyticsMetrics.confirmedRedemptions}</p>
          </article>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="rounded-xl border border-outline-variant/15 overflow-hidden">
            <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/15">
              <h3 className="font-headline font-bold text-on-background">Recent Scan Events</h3>
            </div>

            {scanEvents.length === 0 ? (
              <div className="p-4 text-sm text-on-surface-variant">No scan events yet.</div>
            ) : (
              <ul className="divide-y divide-outline-variant/10">
                {scanEvents.map((event) => (
                  <li key={event.id} className="px-4 py-3 text-sm">
                    <p className="font-bold text-on-background">{event.brand} · {event.scan_result}</p>
                    <p className="text-on-surface-variant text-xs mt-1">
                      Code: {event.scanned_code} · Method: {event.scan_method}
                    </p>
                    <p className="text-on-surface-variant text-xs mt-1">
                      Partner: {shortId(event.partner_id)} · Deal: {event.deal_id || "-"} · {formatDateTime(event.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-outline-variant/15 overflow-hidden">
            <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/15">
              <h3 className="font-headline font-bold text-on-background">Recent Confirmed Redemptions</h3>
            </div>

            {confirmedRedemptions.length === 0 ? (
              <div className="p-4 text-sm text-on-surface-variant">No confirmed redemptions yet.</div>
            ) : (
              <ul className="divide-y divide-outline-variant/10">
                {confirmedRedemptions.map((entry) => (
                  <li key={entry.id} className="px-4 py-3 text-sm">
                    <p className="font-bold text-on-background">{entry.brand} · {entry.redemption_code}</p>
                    <p className="text-on-surface-variant text-xs mt-1">
                      Partner: {shortId(entry.partner_id)} · Deal: {entry.deal_id}
                    </p>
                    <p className="text-on-surface-variant text-xs mt-1">
                      {formatDateTime(entry.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="bg-error/10 border border-error/20 rounded-xl p-5">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      ) : pendingDeals.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/20 p-8 text-center">
          <p className="font-headline font-bold text-on-background text-lg mb-1">Queue is clear</p>
          <p className="text-on-surface-variant text-sm">No pending deals need moderation right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {pendingDeals.map((deal) => {
            const isActing = actingDealId === deal.id;

            return (
              <article
                key={deal.id}
                className="bg-surface rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm"
              >
                <div className="aspect-[16/9] bg-surface-container-low overflow-hidden">
                  <img
                    src={deal.image_url}
                    alt={`${deal.brand} deal preview`}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="p-5 md:p-6">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-xs font-bold tracking-[0.2em] uppercase text-primary">{deal.category}</p>
                    <span className="text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-wider">
                      {deal.type}
                    </span>
                  </div>

                  <h2 className="font-headline font-extrabold text-2xl tracking-tight text-on-background mb-1">
                    {deal.title}
                  </h2>
                  <p className="text-on-surface-variant text-sm mb-4">{deal.brand}</p>

                  <div className="inline-flex items-center gap-2 rounded-full bg-primary-container/35 border border-primary/15 px-3 py-1.5 mb-5">
                    <span className="material-symbols-outlined text-primary text-base">local_offer</span>
                    <span className="text-primary text-sm font-headline font-bold">{deal.discount}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => handleApprove(deal.id)}
                      disabled={isActing}
                      className="flex-1 inline-flex items-center justify-center gap-2 emerald-gradient text-on-primary py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isActing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">done</span>
                          Approve
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleReject(deal.id)}
                      disabled={isActing}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-error text-white py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isActing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">close</span>
                          Reject
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default AdminDashboard;
