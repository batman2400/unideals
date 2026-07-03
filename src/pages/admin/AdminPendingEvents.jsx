import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";

function AdminPendingEvents() {
  const { role, loading: roleLoading } = useRoleContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [actingEventId, setActingEventId] = useState(null);
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
        .from("events")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!active) return;
      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }
      setEvents(data || []);
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
      setActingEventId(id);
      setError("");

      if (action === "reject") {
        const reason = window.prompt(
          "Optional: Provide a reason for rejection (or press Cancel to abort):"
        );
        // User pressed Cancel on the prompt
        if (reason === null) {
          setActingEventId(null);
          return;
        }
      }

      const newStatus = action === "approve" ? "approved" : "rejected";
      const { error: updateError } = await supabase
        .from("events")
        .update({ status: newStatus })
        .eq("id", id);

      if (!isMountedRef.current) return;
      if (updateError) {
        setActingEventId(null);
        setError(updateError.message);
        return;
      }

      setEvents((prev) => prev.filter((e) => e.id !== id));
      setActingEventId(null);
      showMessage(
        action === "approve"
          ? "Event approved and now live on the public feed."
          : "Event rejected and removed from queue.",
      );
    },
    [showMessage],
  );

  const formatDateTime = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (roleLoading || loading) {
    return (
      <PortalLayout portalType="admin">
        <div className="space-y-5">
          <div className="h-8 w-56 rounded-xl skeleton-shimmer" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-80 rounded-2xl skeleton-shimmer" />
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
            Pending Events
          </h1>
          {events.length > 0 && (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 text-amber-700 text-xs font-black">
              {events.length}
            </span>
          )}
        </div>
        <p className="text-on-surface-variant text-sm">
          Review and moderate user-submitted events before they go live on the
          public feed.
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

      {events.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-emerald-400 mb-3 block">
            verified
          </span>
          <p className="font-headline font-bold text-lg text-on-background mb-1">
            Queue is clear
          </p>
          <p className="text-on-surface-variant text-sm">
            No events need moderation right now. Check back later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {events.map((event) => {
            const isActing = actingEventId === event.id;
            return (
              <article
                key={event.id}
                className="bg-surface rounded-2xl border border-outline-variant/15 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Cover Image */}
                <div className="aspect-[16/9] bg-surface-container-low overflow-hidden relative">
                  {event.cover_image_url ? (
                    <img
                      src={event.cover_image_url}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-surface to-primary/5">
                      <span className="material-symbols-outlined text-5xl text-primary/30 mb-2">
                        event
                      </span>
                      <span className="text-xs font-bold text-primary/30 uppercase tracking-widest">
                        No Cover Image
                      </span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex gap-2">
                    <span className="bg-amber-100/90 backdrop-blur-sm text-amber-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-amber-200/60">
                      Pending Review
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  {/* Category & Audience Tags */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold tracking-[0.15em] text-primary uppercase bg-primary/10 px-2.5 py-1 rounded-md">
                      {event.category || "Uncategorized"}
                    </span>
                    <span className="text-[10px] font-bold tracking-[0.1em] text-on-surface-variant uppercase bg-surface-container-high border border-outline-variant/20 px-2.5 py-1 rounded-md">
                      {(event.target_audience || "all_students").replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-headline font-extrabold text-xl tracking-tight text-on-background mb-1 line-clamp-2">
                    {event.title}
                  </h3>

                  {/* University & Club */}
                  {(event.university_name || event.club_name) && (
                    <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-3">
                      <span className="material-symbols-outlined text-[16px]">school</span>
                      <span className="truncate">
                        {event.university_name || ""}
                        {event.university_name && event.club_name ? " · " : ""}
                        {event.club_name || ""}
                      </span>
                    </div>
                  )}

                  {/* Date, Time, Location */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      <span>{formatDateTime(event.start_time)}</span>
                      {event.end_time && (
                        <span className="text-on-surface-variant/50">
                          → {formatDateTime(event.end_time)}
                        </span>
                      )}
                    </div>
                    {event.location_name && (
                      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-[16px]">location_on</span>
                        <span className="truncate">{event.location_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Description Preview */}
                  {event.description && (
                    <p className="text-on-surface-variant text-xs leading-relaxed mb-4 line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  {/* Organizer Info */}
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-5 border-t border-outline-variant/10 pt-3">
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    <span className="truncate">Organizer: {event.organizer_id?.slice(0, 8)}...</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAction(event.id, "approve")}
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
                      onClick={() => handleAction(event.id, "reject")}
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

export default AdminPendingEvents;
