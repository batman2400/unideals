import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import { getPartnerBrand } from "../../lib/partnerBrand";
import PortalLayout from "../../layouts/PortalLayout";
import { isComingSoonEvent, isFinishedEvent } from "../../lib/comingSoon";

function PartnerEvents({ finishedOnly = false }) {
  const {
    user,
    role,
    loading: roleLoading,
    impersonatedPartnerId,
  } = useRoleContext();
  const targetUserId = impersonatedPartnerId || user?.id;
  const [partnerBrand, setPartnerBrand] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const fetchEvents = useCallback(async () => {
    if (roleLoading || !role) return;

    if (!user?.id || (role !== "partner" && role !== "admin")) {
      setError("You don't have access to the partner portal.");
      setLoading(false);
      return;
    }

    if (role === "admin" && !impersonatedPartnerId) {
      setError(
        "Admin View: Viewing partner portal without a specific brand profile. Use the sidebar to impersonate a brand.",
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { brandName } = await getPartnerBrand(targetUserId);
    if (!isMountedRef.current) return;
    setPartnerBrand(brandName || "");

    const { data, error: fetchError } = await supabase
      .from("events")
      .select("*")
      .eq("organizer_id", targetUserId)
      .order("start_time", { ascending: false });

    if (!isMountedRef.current) return;

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const rows = (data || []).filter((event) => {
      const finished = isFinishedEvent(event);
      return finishedOnly ? finished : !finished;
    });

    if (finishedOnly) {
      rows.sort((a, b) => {
        const aT = new Date(a.end_time || a.start_time).getTime();
        const bT = new Date(b.end_time || b.start_time).getTime();
        return bT - aT;
      });
    }

    setEvents(rows);
    setLoading(false);
  }, [user?.id, role, impersonatedPartnerId, targetUserId, finishedOnly]);

  useEffect(() => {
    if (roleLoading) return;
    fetchEvents();
  }, [roleLoading, fetchEvents]);

  if (roleLoading || loading) {
    return (
      <PortalLayout portalType="partner" brandName="">
        <div className="space-y-5">
          <div className="h-8 w-40 rounded-xl skeleton-shimmer" />
          <div className="h-12 rounded-xl skeleton-shimmer" />
          <div className="h-96 rounded-2xl skeleton-shimmer" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout portalType="partner" brandName={partnerBrand}>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
            {finishedOnly ? "Finished Events" : "My Events"}
          </h1>
          <p className="text-on-surface-variant text-sm">
            {finishedOnly
              ? "Past events you submitted — hidden from students."
              : "Campus events you submitted. Pending items wait for admin approval."}
          </p>
        </div>
        {!finishedOnly && (
          <Link
            to="/events/new"
            className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-5 py-2.5 rounded-xl font-headline font-bold text-sm shadow-sm hover:shadow-md transition-all"
          >
            <span className="material-symbols-outlined text-lg">
              event_available
            </span>
            Create Event
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

      {events.length === 0 && !error ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-3 block">
            event
          </span>
          <p className="font-headline font-bold text-lg text-on-background mb-1">
            {finishedOnly ? "No finished events" : "No events yet"}
          </p>
          <p className="text-on-surface-variant text-sm">
            {finishedOnly
              ? "Ended events you organized will appear here."
              : "Submit a campus event to see it here."}
          </p>
        </div>
      ) : events.length > 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full block md:table">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-outline-variant/10 bg-surface-container-low/50 block md:table-row">
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Event
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Start Time
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Status
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group divide-y divide-outline-variant/8">
                {events.map((event) => {
                  const comingSoon = isComingSoonEvent(event);
                  const finished = isFinishedEvent(event);
                  const statusLabel = comingSoon
                    ? "coming soon"
                    : finished
                      ? "finished"
                      : event.status || "pending";
                  const statusClass = comingSoon
                    ? "text-sky-700 bg-sky-50 border-sky-200"
                    : finished
                      ? "text-on-surface-variant bg-surface-container-high border-outline-variant/50"
                      : event.status === "approved"
                        ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                        : event.status === "rejected"
                          ? "text-red-600 bg-red-50 border-red-200"
                          : "text-amber-600 bg-amber-50 border-amber-200";

                  return (
                    <tr
                      key={event.id}
                      className="block md:table-row p-4 md:p-0 hover:bg-surface-container-low/30 transition-colors border-b border-outline-variant/8 md:border-none last:border-none"
                    >
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Event
                        </span>
                        <div className="min-w-0 text-right md:text-left">
                          <p className="font-headline font-bold text-sm text-on-background truncate max-w-[220px]">
                            {event.title}
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            {event.university_name || event.category || ""}
                          </p>
                        </div>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-surface-variant">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Start Time
                        </span>
                        <span className="text-right md:text-left">
                          {event.start_time
                            ? new Date(event.start_time).toLocaleString()
                            : "-"}
                        </span>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm md:text-center">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Status
                        </span>
                        <span
                          className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="flex justify-end items-center md:table-cell px-0 md:px-4 py-3">
                        <Link
                          to={`/events/${event.id}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                          title="View event"
                        >
                          <span className="material-symbols-outlined text-lg">
                            open_in_new
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </PortalLayout>
  );
}

export default PartnerEvents;
