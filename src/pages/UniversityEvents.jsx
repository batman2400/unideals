import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function UniversityEvents() {
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPastEvents, setShowPastEvents] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch ALL approved events (no date filter — we split them client-side)
      const { data, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("status", "approved")
        .order("start_time", { ascending: true });

      if (fetchError) throw fetchError;
      setAllEvents(data || []);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Failed to load events. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Split events into active (upcoming + ongoing) and past
  const { activeEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    const active = [];
    const past = [];

    for (const event of allEvents) {
      const startTime = new Date(event.start_time);
      const endTime = event.end_time ? new Date(event.end_time) : null;

      // An event is "active" (visible by default) if:
      // 1. Its start_time is in the future (upcoming), OR
      // 2. It has an end_time that hasn't passed yet (ongoing), OR
      // 3. It has no end_time but started less than 24 hours ago (grace period)
      const isUpcoming = startTime > now;
      const isOngoing = endTime && endTime > now;
      const isRecentNoEnd = !endTime && (now - startTime) < 24 * 60 * 60 * 1000;

      if (isUpcoming || isOngoing || isRecentNoEnd) {
        active.push(event);
      } else {
        past.push(event);
      }
    }

    // Active events: soonest first
    active.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    // Past events: most recent first
    past.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    return { activeEvents: active, pastEvents: past };
  }, [allEvents]);

  const formatDateTime = (dateString) => {
    if (!dateString) return "";
    const options = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const getEventStatus = (event) => {
    const now = new Date();
    const startTime = new Date(event.start_time);
    const endTime = event.end_time ? new Date(event.end_time) : null;

    if (startTime > now) return null; // upcoming, no badge needed
    if (endTime && endTime > now) return "happening now";
    if (!endTime && (now - startTime) < 24 * 60 * 60 * 1000) return "happening now";
    return "past";
  };

  const renderEventCard = (event) => {
    const status = getEventStatus(event);

    return (
      <Link 
        to={`/events/${event.id}`}
        key={event.id} 
        className={`w-full max-w-sm sm:max-w-none bg-surface rounded-3xl border border-outline-variant/20 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col ${status === 'past' ? 'opacity-75' : ''}`}
      >
        {/* Image Header */}
        <div className="relative w-full h-48 sm:h-56 overflow-hidden bg-surface-container-high">
          {event.cover_image_url ? (
            <img 
              src={event.cover_image_url} 
              alt={event.title} 
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out ${status === 'past' ? 'grayscale-[30%]' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-surface to-primary/5">
              <span className="material-symbols-outlined text-5xl text-primary/30 mb-2">
                event
              </span>
              <span className="text-xs font-bold text-primary/30 uppercase tracking-widest">
                Unideals Event
              </span>
            </div>
          )}
          <div className="absolute top-4 left-4 bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 shadow-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
            <span className="text-xs font-bold text-on-surface">
              {new Date(event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          {status === 'happening now' && (
            <div className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Live Now</span>
            </div>
          )}
          {status === 'past' && (
            <div className="absolute top-4 right-4 bg-on-surface/70 text-white px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">history</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Past Event</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col flex-grow">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase bg-primary/10 px-2.5 py-1 rounded-md">
                {event.category || 'Event'}
              </span>
              {event.university_name && (
                <span className="text-[10px] font-bold tracking-[0.1em] text-on-surface-variant uppercase bg-surface-container-high border border-outline-variant/20 px-2.5 py-1 rounded-md">
                  {event.university_name}
                </span>
              )}
            </div>
          </div>
          
          <h3 className="font-headline font-extrabold text-xl text-on-background mb-2 line-clamp-2 leading-tight">
            {event.title}
          </h3>
          
          <p className="text-sm text-on-surface-variant line-clamp-2 mb-6">
            {event.description}
          </p>

          <div className="mt-auto space-y-2.5 mb-6">
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">schedule</span>
              <span>{formatDateTime(event.start_time)}</span>
            </div>
            {event.location_name && (
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">location_on</span>
                <span className="line-clamp-1">{event.location_name}</span>
              </div>
            )}
          </div>

          <button 
            className="w-full py-3.5 rounded-xl font-headline font-bold text-sm flex items-center justify-center gap-2 transition-all bg-surface-container border border-outline-variant/20 text-on-surface hover:bg-primary hover:text-on-primary hover:border-primary hover:shadow-md"
          >
            View Event Details
            <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
        </div>
      </Link>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background">
            Events
          </h1>
          <p className="text-on-surface-variant text-base mt-2 max-w-2xl">
            Discover exclusive networking sessions, tech fests, and social gatherings on campus.
          </p>
        </div>
        <Link
          to="/events/new"
          className="inline-flex items-center justify-center gap-1.5 px-5 py-3 bg-primary text-on-primary hover:bg-primary/90 font-headline font-bold text-sm rounded-xl transition-all shadow-sm active:scale-[0.98] self-start sm:self-center"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          Submit an Event
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface rounded-3xl border border-outline-variant/20 overflow-hidden shadow-sm animate-pulse">
              <div className="w-full h-48 bg-outline-variant/10"></div>
              <div className="p-6 space-y-4">
                <div className="h-4 bg-outline-variant/10 rounded w-1/4"></div>
                <div className="h-6 bg-outline-variant/10 rounded w-3/4"></div>
                <div className="h-4 bg-outline-variant/10 rounded w-full"></div>
                <div className="h-4 bg-outline-variant/10 rounded w-5/6"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-error/10 border border-error/20 rounded-2xl p-6 text-center">
          <span className="material-symbols-outlined text-error text-3xl mb-2">error</span>
          <p className="text-error font-bold">{error}</p>
          <button 
            onClick={fetchEvents}
            className="mt-4 px-4 py-2 bg-error text-white text-sm font-bold rounded-xl hover:bg-error/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : allEvents.length === 0 ? (
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-20 h-20 rounded-full bg-primary-container/30 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-primary text-4xl">
              event_busy
            </span>
          </div>
          <h2 className="font-headline font-bold text-2xl text-on-background mb-3">
            No events yet
          </h2>
          <p className="text-on-surface-variant text-base max-w-md">
            We are currently partnering with university societies to bring you the best events. Check back soon!
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Upcoming & Ongoing Events */}
          {activeEvents.length > 0 ? (
            <div>
              <h2 className="font-headline font-bold text-xl text-on-background mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">event_available</span>
                Upcoming & Ongoing
                <span className="text-sm font-normal text-on-surface-variant ml-1">({activeEvents.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 justify-items-center sm:justify-items-stretch">
                {activeEvents.map(renderEventCard)}
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-low border border-outline-variant/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="w-20 h-20 rounded-full bg-primary-container/30 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-primary text-4xl">
                  event_busy
                </span>
              </div>
              <h2 className="font-headline font-bold text-2xl text-on-background mb-3">
                No upcoming events
              </h2>
              <p className="text-on-surface-variant text-base max-w-md">
                No upcoming events right now, but check out past events below!
              </p>
            </div>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div>
              <button
                onClick={() => setShowPastEvents(!showPastEvents)}
                className="font-headline font-bold text-xl text-on-background mb-6 flex items-center gap-2 hover:text-primary transition-colors cursor-pointer group"
              >
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">history</span>
                Past Events
                <span className="text-sm font-normal text-on-surface-variant ml-1">({pastEvents.length})</span>
                <span className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform ${showPastEvents ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>
              {showPastEvents && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 justify-items-center sm:justify-items-stretch animate-fade-in">
                  {pastEvents.map(renderEventCard)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
