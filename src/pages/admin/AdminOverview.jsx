import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";

function AdminOverview() {
  const { role, loading: roleLoading } = useRoleContext();
  const [metrics, setMetrics] = useState({
    totalDeals: 0,
    pendingDeals: 0,
    approvedDeals: 0,
    rejectedDeals: 0,
    totalUsers: 0,
    totalPartners: 0,
    totalScans: 0,
    confirmedRedemptions: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [actingVerificationId, setActingVerificationId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isMountedRef = useRef(true);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      if (isMountedRef.current) setMessage("");
    }, 4000);
  };

  useEffect(() => {
    if (roleLoading || role !== "admin") return;

    let active = true;

    async function fetchOverview() {
      setLoading(true);
      setError("");

      try {
        const [
          pendingRes,
          approvedRes,
          rejectedRes,
          usersRes,
          partnersRes,
          scansRes,
          confirmedRes,
          recentEventsRes,
        ] = await Promise.all([
          supabase
            .from("deals")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("deals")
            .select("id", { count: "exact", head: true })
            .eq("status", "approved"),
          supabase
            .from("deals")
            .select("id", { count: "exact", head: true })
            .eq("status", "rejected"),
          supabase.rpc("list_users_with_roles", {
            search_query: "",
            role_filter: null,
            page_limit: 1,
            page_offset: 0,
          }),
          supabase.rpc("list_users_with_roles", {
            search_query: "",
            role_filter: "partner",
            page_limit: 1,
            page_offset: 0,
          }),
          supabase
            .from("redemption_events")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("confirmed_redemptions")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("redemption_events")
            .select(
              "id, brand, scanned_code, scan_result, scan_method, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("manual_verifications")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: false }),
        ]);

        if (!active) return;

        const totalUsers = usersRes.data?.[0]?.total_count ?? 0;
        const totalPartners = partnersRes.data?.[0]?.total_count ?? 0;

        setMetrics({
          totalDeals:
            (pendingRes.count ?? 0) +
            (approvedRes.count ?? 0) +
            (rejectedRes.count ?? 0),
          pendingDeals: pendingRes.count ?? 0,
          approvedDeals: approvedRes.count ?? 0,
          rejectedDeals: rejectedRes.count ?? 0,
          totalUsers: Number(totalUsers),
          totalPartners: Number(totalPartners),
          totalScans: scansRes.count ?? 0,
          confirmedRedemptions: confirmedRes.count ?? 0,
        });
        setRecentActivity(recentEventsRes.data || []);
        
        const verificationsRes = arguments[0]?.[8] || arguments[8] || (await supabase.from("manual_verifications").select("*").eq("status", "pending").order("created_at", { ascending: false }));
        setPendingVerifications(verificationsRes.data || []);
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Failed to load overview data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchOverview();
    return () => {
      active = false;
    };
  }, [role, roleLoading]);

  if (roleLoading || loading) {
    return (
      <PortalLayout portalType="admin">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="h-8 w-48 rounded-xl skeleton-shimmer" />
            <div className="h-5 w-80 rounded-lg skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl skeleton-shimmer" />
            ))}
          </div>
          <div className="h-64 rounded-2xl skeleton-shimmer" />
        </div>
      </PortalLayout>
    );
  }

  if (role !== "admin") {
    return (
      <PortalLayout portalType="admin">
        <div className="bg-error/10 border border-error/20 rounded-2xl p-6">
          <p className="text-error font-headline font-bold">
            Access denied. Admin role required.
          </p>
        </div>
      </PortalLayout>
    );
  }

  const metricCards = [
    {
      label: "Total Deals",
      value: metrics.totalDeals,
      icon: "inventory_2",
      color: "text-on-background",
    },
    {
      label: "Pending Review",
      value: metrics.pendingDeals,
      icon: "pending_actions",
      color: "text-amber-600",
    },
    {
      label: "Approved",
      value: metrics.approvedDeals,
      icon: "check_circle",
      color: "text-emerald-600",
    },
    {
      label: "Rejected",
      value: metrics.rejectedDeals,
      icon: "cancel",
      color: "text-red-600",
    },
    {
      label: "Total Users",
      value: metrics.totalUsers,
      icon: "group",
      color: "text-on-background",
    },
    {
      label: "Partners",
      value: metrics.totalPartners,
      icon: "handshake",
      color: "text-primary",
    },
    {
      label: "Total Scans",
      value: metrics.totalScans,
      icon: "qr_code_scanner",
      color: "text-on-background",
    },
    {
      label: "Redemptions",
      value: metrics.confirmedRedemptions,
      icon: "task_alt",
      color: "text-emerald-600",
    },
  ];

  const scanResultColor = {
    valid: "text-emerald-600 bg-emerald-50 border-emerald-200",
    not_found: "text-red-600 bg-red-50 border-red-200",
    wrong_brand: "text-red-600 bg-red-50 border-red-200",
    not_approved: "text-amber-600 bg-amber-50 border-amber-200",
    invalid: "text-red-600 bg-red-50 border-red-200",
  };

  const handleApproveVerification = async (id, targetUserId, targetEmail) => {
    if (role !== "admin") return;
    setActingVerificationId(id);
    setError("");

    const { error: updateError } = await supabase.rpc("approve_manual_verification", {
      request_id: id,
      target_user_id: targetUserId,
      target_email: targetEmail
    });

    if (!isMountedRef.current) return;

    if (updateError) {
      setActingVerificationId(null);
      setError(updateError.message || "Failed to approve verification.");
      return;
    }

    setPendingVerifications((prev) => prev.filter((v) => v.id !== id));
    setActingVerificationId(null);
    showMessage("Student verification approved successfully.", "success");
  };

  const handleRejectVerification = async (id) => {
    if (role !== "admin") return;
    setActingVerificationId(id);
    setError("");

    const { error: updateError } = await supabase.rpc("reject_manual_verification", {
      request_id: id
    });

    if (!isMountedRef.current) return;

    if (updateError) {
      setActingVerificationId(null);
      setError(updateError.message || "Failed to reject verification.");
      return;
    }

    setPendingVerifications((prev) => prev.filter((v) => v.id !== id));
    setActingVerificationId(null);
    showMessage("Student verification rejected.", "success");
  };

  return (
    <PortalLayout portalType="admin">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
          Dashboard Overview
        </h1>
        <p className="text-on-surface-variant text-sm">
          Platform health at a glance — deals, users, and redemption activity.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {metricCards.map((card) => (
          <article
            key={card.label}
            className="bg-surface rounded-2xl border border-outline-variant/15 p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow"
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

      {/* Recent Activity */}
      <div className="bg-surface rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/10">
          <h2 className="font-headline font-bold text-lg text-on-background">
            Recent Scan Activity
          </h2>
        </div>

        {recentActivity.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">
              qr_code_scanner
            </span>
            <p className="text-on-surface-variant text-sm">
              No scan activity yet.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant/8">
            {recentActivity.map((event) => (
              <li
                key={event.id}
                className="px-5 py-3.5 flex items-center gap-4 hover:bg-surface-container-low/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-bold text-sm text-on-background truncate">
                    {event.brand}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Code: {event.scanned_code || "—"} · {event.scan_method}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${scanResultColor[event.scan_result] || scanResultColor.invalid}`}
                >
                  {event.scan_result}
                </span>
                <p className="text-xs text-on-surface-variant/60 hidden md:block whitespace-nowrap">
                  {new Date(event.created_at).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Manual Verifications Section */}
      <div className="mt-12 mb-8 border-t border-outline-variant/10 pt-12">
        <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase block mb-2">
          Student Moderation
        </span>
        <h2 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background mb-2">
          Manual Verifications
        </h2>
        <p className="text-on-surface-variant text-sm md:text-base max-w-2xl mb-8">
          Review documents submitted by students whose emails couldn't be automatically verified.
        </p>

        {pendingVerifications.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-outline-variant/20 p-8 text-center shadow-sm">
            <p className="font-headline font-bold text-on-background text-lg mb-1">
              No Pending Verifications
            </p>
            <p className="text-on-surface-variant text-sm">
              All students are verified and good to go!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {pendingVerifications.map((req) => {
              const isActing = actingVerificationId === req.id;

              return (
                <article
                  key={req.id}
                  className="bg-surface rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm flex flex-col sm:flex-row"
                >
                  <a 
                    href={req.proof_image_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full sm:w-48 bg-surface-container-low overflow-hidden block flex-shrink-0 border-r border-outline-variant/10 hover:opacity-90 transition-opacity"
                    title="Click to view full image in new tab"
                  >
                    <img
                      src={req.proof_image_url}
                      alt="Proof document"
                      className="w-full h-full object-cover sm:min-h-[220px]"
                    />
                  </a>

                  <div className="p-5 md:p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-xs font-bold tracking-[0.2em] uppercase text-primary">
                          {req.institution_type}
                        </p>
                        <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider">
                          {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="font-headline font-extrabold text-xl tracking-tight text-on-background mb-1">
                        {req.institution_name}
                      </h3>
                      
                      {req.institution_type === "university" && (
                        <p className="text-on-surface-variant text-sm mb-1">
                          <span className="font-bold">Course:</span> {req.course_details}
                        </p>
                      )}
                      
                      {req.institution_type === "university" && (
                        <p className="text-on-surface-variant text-sm mb-1">
                          <span className="font-bold">ID:</span> {req.student_id_number}
                        </p>
                      )}

                      <p className="text-on-surface-variant text-sm mb-5">
                        <span className="font-bold">Email:</span> {req.contact_email}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <button
                        onClick={() => handleApproveVerification(req.id, req.user_id, req.contact_email)}
                        disabled={isActing}
                        className="flex-1 inline-flex items-center justify-center gap-2 emerald-gradient text-on-primary py-2.5 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isActing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-base">
                              done
                            </span>
                            Approve
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleRejectVerification(req.id)}
                        disabled={isActing}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-error text-white py-2.5 rounded-lg font-headline font-bold text-sm tracking-tight shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isActing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-base">
                              close
                            </span>
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
      </div>
    </PortalLayout>
  );
}

export default AdminOverview;
