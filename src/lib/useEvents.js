/**
 * useEvents Hook
 *
 * Fetches approved public events from Supabase.
 * Finished (past) events are omitted — they live in admin/partner archives.
 * Returns { events, loading, error, refetch }.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { isFinishedEvent } from "./comingSoon";

function excludeFinished(rows) {
  return (rows || []).filter((event) => !isFinishedEvent(event));
}

export function useEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("events")
      .select("*")
      .eq("status", "approved")
      .order("start_time", { ascending: true });

    if (fetchError) {
      console.error("[useEvents] Fetch error:", fetchError.message);
      setError("Failed to load events. Please try again later.");
      setLoading(false);
      return;
    }

    setEvents(excludeFinished(data));
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("status", "approved")
        .order("start_time", { ascending: true });

      if (cancelled) return;

      if (fetchError) {
        console.error("[useEvents] Fetch error:", fetchError.message);
        setError("Failed to load events. Please try again later.");
        setLoading(false);
        return;
      }

      setEvents(excludeFinished(data));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { events, loading, error, refetch: fetchEvents };
}
