import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";
import { signVerificationProofs } from "../../lib/verificationProof";
import {
  VERIFICATION_REJECT_REASONS,
  formatVerificationRejectReason,
} from "../../lib/verificationRejectReasons";
import { notifyVerificationRejected } from "../../lib/notifyVerificationRejected";

function inQueue(row, queue) {
  if (queue === "email_otp") {
    return row.method === "email_otp" && row.status === "awaiting_confirmation";
  }
  return row.method !== "email_otp" && row.status === "pending";
}

function AdminVerifications() {
  const { role, loading: roleLoading } = useRoleContext();
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [proofUrls, setProofUrls] = useState({});
  const [queue, setQueue] = useState("email_otp");
  const [actingVerificationId, setActingVerificationId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectPreset, setRejectPreset] = useState("unreadable");
  const [rejectNote, setRejectNote] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
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
          .in("status", ["pending", "awaiting_confirmation"])
          .order("created_at", { ascending: false });

        if (!active) return;

        if (fetchError) {
          setError(fetchError.message || "Failed to load pending verifications.");
        } else {
          const rows = data || [];
          setPendingVerifications(rows);

          const signed = await Promise.all(
            rows.map(async (row) => [row.id, await signVerificationProofs(row)]),
          );

          if (!active) return;
          setProofUrls(Object.fromEntries(signed));
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

  const emailCount = useMemo(
    () => pendingVerifications.filter((row) => inQueue(row, "email_otp")).length,
    [pendingVerifications],
  );
  const manualCount = useMemo(
    () => pendingVerifications.filter((row) => inQueue(row, "manual")).length,
    [pendingVerifications],
  );
  const visible = useMemo(
    () => pendingVerifications.filter((row) => inQueue(row, queue)),
    [pendingVerifications, queue],
  );

  const handleApproveVerification = async (id) => {
    if (role !== "admin" || actingVerificationId) return;
    if (!window.confirm("Approve this student and grant them verified status?")) return;

    setActingVerificationId(id);
    setError("");

    const { error: updateError } = await supabase.rpc("approve_manual_verification", {
      request_id: id,
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
    if (role !== "admin" || actingVerificationId) return;
    const reason = formatVerificationRejectReason(rejectPreset, rejectNote);
    setActingVerificationId(id);
    setError("");

    const { error: updateError } = await supabase.rpc("reject_manual_verification", {
      request_id: id,
      reason,
    });

    if (!isMountedRef.current) return;

    if (updateError) {
      setActingVerificationId(null);
      setError(updateError.message || "Failed to reject verification.");
      return;
    }

    await notifyVerificationRejected(id);
    if (!isMountedRef.current) return;

    setPendingVerifications((prev) => prev.filter((v) => v.id !== id));
    setActingVerificationId(null);
    setRejectingId(null);
    setRejectNote("");
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
          Email OTP is the fast lane after inbox confirmation. Manual includes school students
          and anyone without an institute email.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setQueue("email_otp")}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-bold ${
            queue === "email_otp"
              ? "bg-primary text-on-primary"
              : "bg-surface text-on-surface-variant border border-outline-variant/20"
          }`}
        >
          Email OTP ({emailCount})
        </button>
        <button
          type="button"
          onClick={() => setQueue("manual")}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-bold ${
            queue === "manual"
              ? "bg-primary text-on-primary"
              : "bg-surface text-on-surface-variant border border-outline-variant/20"
          }`}
        >
          Manual ({manualCount})
        </button>
      </div>

      {message && (
        <div
          className={`mb-5 rounded-xl px-4 py-3 border ${
            messageType === "error"
              ? "bg-error/10 border-error/20"
              : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <p
            className={`text-sm font-bold ${
              messageType === "error" ? "text-error" : "text-emerald-700"
            }`}
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

      {visible.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/20 p-8 text-center shadow-sm">
          <p className="font-headline font-bold text-on-background text-lg mb-1">
            No pending requests
          </p>
          <p className="text-on-surface-variant text-sm">
            {queue === "email_otp"
              ? "No university-email requests are waiting for confirmation."
              : "No manual or school requests are waiting for review."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {visible.map((req) => {
            const isActing = actingVerificationId === req.id;
            const proofs = proofUrls[req.id] || {};

            return (
              <article
                key={req.id}
                className="bg-surface rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm"
              >
                <div className="grid grid-cols-2">
                  {["front", "back"].map((side) => {
                    const url = proofs[side];
                    return url ? (
                      <a
                        key={side}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-surface-container-low overflow-hidden block border-r border-outline-variant/10 hover:opacity-90 transition-opacity"
                        title={`View ${side} of ID`}
                      >
                        <img
                          src={url}
                          alt={`Student ID ${side}`}
                          className="w-full h-44 object-cover"
                        />
                      </a>
                    ) : (
                      <div
                        key={side}
                        className="bg-surface-container-low flex items-center justify-center p-4 h-44"
                      >
                        <p className="text-xs text-on-surface-variant text-center">
                          {side} unavailable
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="p-5 md:p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-xs font-bold tracking-[0.2em] uppercase text-primary">
                        {req.method === "email_otp" ? "Email OTP" : req.institution_type}
                      </p>
                      <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider">
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="font-headline font-extrabold text-xl tracking-tight text-on-background mb-1">
                      {req.institution_name}
                    </h3>

                    {req.course_details && (
                      <p className="text-on-surface-variant text-sm mb-1">
                        <span className="font-bold">
                          {req.institution_type === "school" ? "Grade:" : "Course:"}
                        </span>{" "}
                        {req.course_details}
                      </p>
                    )}

                    {req.student_id_number && (
                      <p className="text-on-surface-variant text-sm mb-1">
                        <span className="font-bold">ID:</span> {req.student_id_number}
                      </p>
                    )}

                    <p className="text-on-surface-variant text-sm mb-5">
                      <span className="font-bold">Email:</span> {req.contact_email}
                    </p>
                  </div>

                  {rejectingId === req.id ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {VERIFICATION_REJECT_REASONS.map((reason) => (
                          <button
                            key={reason.id}
                            type="button"
                            onClick={() => setRejectPreset(reason.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                              rejectPreset === reason.id
                                ? "bg-error text-white"
                                : "bg-surface-container text-on-surface-variant"
                            }`}
                          >
                            {reason.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder={rejectPreset === "other" ? "Describe the issue" : "Optional note"}
                        className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm"
                      />
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setRejectingId(null)}
                          className="flex-1 py-2.5 rounded-lg font-bold text-sm bg-surface-container"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectVerification(req.id)}
                          disabled={isActing}
                          className="flex-1 bg-error text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-70"
                        >
                          {isActing ? "Saving..." : "Confirm reject"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <button
                        onClick={() => handleApproveVerification(req.id)}
                        disabled={isActing}
                        className="flex-1 inline-flex items-center justify-center gap-2 emerald-gradient text-on-primary py-2.5 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isActing ? "Saving..." : "Approve"}
                      </button>

                      <button
                        onClick={() => {
                          setRejectingId(req.id);
                          setRejectPreset("unreadable");
                          setRejectNote("");
                        }}
                        disabled={isActing}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-error text-white py-2.5 rounded-lg font-headline font-bold text-sm tracking-tight shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                    </div>
                  )}
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
