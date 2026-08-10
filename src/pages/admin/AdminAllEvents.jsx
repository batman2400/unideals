import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";

function AdminAllEvents() {
  const { role, loading: roleLoading } = useRoleContext();
  
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [message, setMessage] = useState("");
  const [actingEventId, setActingEventId] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const fetchEvents = useCallback(async () => {
    if (role !== "admin") return;
    setLoading(true);
    setError("");

    let query = supabase
      .from("events")
      .select(`*`)
      .order("start_time", { ascending: false });

    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,university_name.ilike.%${searchQuery}%`);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setEvents(data || []);
    }
    
    setLoading(false);
  }, [role, searchQuery]);

  useEffect(() => {
    if (roleLoading) return;
    fetchEvents();
  }, [roleLoading, fetchEvents]);

  const handleDelete = useCallback(async (eventId) => {
    if (
      !window.confirm("Are you sure you want to delete this event permanently?")
    )
      return;

    setActingEventId(eventId);
    const { error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId);

    if (!isMountedRef.current) return;
    if (deleteError) {
      setError(deleteError.message);
      setActingEventId(null);
      return;
    }

    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setActingEventId(null);
    setMessage("Event deleted permanently.");
    setTimeout(() => {
      if (isMountedRef.current) setMessage("");
    }, 3000);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue]);

  if (roleLoading) {
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
          All Events
        </h1>
        <p className="text-on-surface-variant text-sm">
          Full event catalogue with search and deletion capabilities.
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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search by title, category, or university..."
            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-10 pr-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      {/* Events Table */}
      {loading ? (
        <div className="h-96 rounded-2xl skeleton-shimmer" />
      ) : events.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">
            search_off
          </span>
          <p className="text-on-surface-variant text-sm">No events found.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full block md:table">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-outline-variant/10 bg-surface-container-low/50 block md:table-row">
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Event
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    University / Club
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Start Time
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Go-Live
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Status
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    RSVPs
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group divide-y divide-outline-variant/8">
                {events.map((event) => {
                  const isActing = actingEventId === event.id;

                  return (
                    <tr
                      key={event.id}
                      className="block md:table-row p-4 md:p-0 hover:bg-surface-container-low/30 transition-colors border-b border-outline-variant/8 md:border-none last:border-none"
                    >
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Event
                        </span>
                        <div className="flex items-center gap-3 max-w-[220px] md:max-w-none text-right md:text-left">
                          <div className="hidden md:block w-10 h-10 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0">
                            {event.cover_image_url ? (
                              <img
                                src={event.cover_image_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                <span className="material-symbols-outlined text-primary text-xl">event</span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-headline font-bold text-sm text-on-background truncate max-w-[150px] md:max-w-[200px]">
                              {event.title}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-surface-variant font-bold">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Category
                        </span>
                        <span className="text-right md:text-left capitalize">
                          {event.category || "Uncategorized"}
                        </span>
                      </td>
                      <td className="flex flex-col md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase mb-1">
                          University / Club
                        </span>
                        <div className="text-right md:text-left">
                          <p className="text-sm font-bold text-on-background">
                            {event.university_name || "-"}
                          </p>
                          <p className="text-xs text-on-surface-variant truncate max-w-[150px] md:max-w-none">
                            {event.club_name || ""}
                          </p>
                        </div>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-surface-variant">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Start Time
                        </span>
                        <span className="text-right md:text-left">
                          {event.start_time ? new Date(event.start_time).toLocaleString() : "-"}
                        </span>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-surface-variant">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Go-Live
                        </span>
                        <span className="text-right md:text-left">
                          {event.publish_at
                            ? new Date(event.publish_at).toLocaleString()
                            : "-"}
                        </span>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm md:text-center">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Status
                        </span>
                        <span
                          className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${
                            event.status === "approved" &&
                            event.publish_at &&
                            new Date(event.publish_at) > new Date()
                              ? "text-sky-700 bg-sky-50 border-sky-200"
                              : event.status === "approved"
                                ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                                : event.status === "rejected"
                                  ? "text-red-600 bg-red-50 border-red-200"
                                  : "text-amber-600 bg-amber-50 border-amber-200"
                          }`}
                        >
                          {event.status === "approved" &&
                          event.publish_at &&
                          new Date(event.publish_at) > new Date()
                            ? "coming soon"
                            : event.status || "pending"}
                        </span>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-background font-bold md:text-center tabular-nums">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          RSVPs
                        </span>
                        <span>{event.rsvp_count ?? 0}</span>
                      </td>
                      <td className="flex justify-end items-center md:table-cell px-0 md:px-4 py-3 md:py-3 mt-2 md:mt-0">
                        <div className="flex items-center justify-end md:justify-center gap-1.5 w-full md:w-auto">
                          <button
                            onClick={() => handleDelete(event.id)}
                            disabled={isActing}
                            title="Delete"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-lg">
                              delete
                            </span>
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

export default AdminAllEvents;
