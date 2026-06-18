import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";

function AdminVerifications() {
  const { role, loading: roleLoading } = useRoleContext();
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

    async function fetchVerifications() {
      setLoading(true);
      setError("");

      try {
        const { data, error: fetchError } = await supabase
          .from("manual_verifications")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (!active) return;

        if (fetchError) {
          setError(fetchError.message || "Failed to load pending verifications.");
        } else {
          setPendingVerifications(data || []);
        }
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Failed to load verifications.");
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchVerifications();
    return () => {
      active = false;
    };
  }, [role, roleLoading]);

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

  if (roleLoading || loading) {
    return (
      <PortalLayout portalType="admin">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="h-8 w-48 rounded-xl skeleton-shimmer" />
            <div className="h-5 w-80 rounded-lg skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl skeleton-shimmer" />
            ))}
          </div>
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

  return (
    <PortalLayout portalType="admin">
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
          Student Moderation
        </h1>
        <p className="text-on-surface-variant text-sm">
          Review documents submitted by students whose emails couldn't be automatically verified.
        </p>
      </div>

      {message && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <p className="text-emerald-700 text-sm font-bold">{message}</p>
        </div>
      )}

      {error && (
        <div className="mb-5 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

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
    </PortalLayout>
  );
}

export default AdminVerifications;
