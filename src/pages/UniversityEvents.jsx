import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function UniversityEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch upcoming events ordered by start_time
      const { data, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true });

      if (fetchError) throw fetchError;
      setEvents(data || []);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Failed to load upcoming events. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "";
    const options = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 animate-fade-in">
      <div className="mb-10">
        <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background">
          Upcoming Events
        </h1>
        <p className="text-on-surface-variant text-base mt-2 max-w-2xl">
          Discover exclusive networking sessions, tech fests, and social gatherings on campus.
        </p>
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
      ) : events.length === 0 ? (
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
            We are currently partnering with university societies to bring you the best events. Check back soon!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
          {events.map((event) => (
            <Link 
              to={`/events/${event.id}`}
              key={event.id} 
              className="bg-surface rounded-3xl border border-outline-variant/20 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col"
            >
              {/* Image Header */}
              <div className="relative w-full h-48 sm:h-56 overflow-hidden bg-surface-container-high">
                {event.cover_image_url ? (
                  <img 
                    src={event.cover_image_url} 
                    alt={event.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary-container/20">
                    <span className="material-symbols-outlined text-4xl text-primary/40">
                      image
                    </span>
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 shadow-sm flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
                  <span className="text-xs font-bold text-on-surface">
                    {new Date(event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
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
                  className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-primary/10 text-primary hover:bg-primary/20`}
                >
                  View Event Details
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
