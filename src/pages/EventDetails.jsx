import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "../lib/supabaseClient";
import { formatLaunchDate, isComingSoonEvent } from "../lib/comingSoon";
import { SITE_URL } from "../lib/seo";
import EventSchema from "../components/EventSchema";
import BreadcrumbSchema from "../components/BreadcrumbSchema";

const DEFAULT_OG_IMAGE = `${SITE_URL}/icon-512-v5.png`;

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;
      setEvent(data);
    } catch (err) {
      console.error("Error fetching event details:", err);
      setError("Failed to load event details. The event may have been removed or does not exist.");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "";
    const options = { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 animate-fade-in">
        <div className="animate-pulse space-y-8">
          <div className="w-full h-64 md:h-96 bg-surface-container-low rounded-3xl" />
          <div className="space-y-4">
            <div className="h-8 bg-surface-container-low rounded-xl w-3/4" />
            <div className="h-4 bg-surface-container-low rounded-md w-1/4" />
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-surface-container-low rounded-md w-full" />
            <div className="h-4 bg-surface-container-low rounded-md w-5/6" />
            <div className="h-4 bg-surface-container-low rounded-md w-4/6" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-16 animate-fade-in text-center">
        <Helmet>
          <title>Event Not Found | Uni Deals</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="bg-error/10 border border-error/20 rounded-3xl p-12 inline-block">
          <span className="material-symbols-outlined text-error text-5xl mb-4">event_busy</span>
          <h2 className="font-headline font-bold text-2xl text-on-background mb-2">Event Not Found</h2>
          <p className="text-on-surface-variant max-w-md mx-auto">{error || "This event could not be found."}</p>
          <button 
            onClick={() => navigate('/events')}
            className="mt-6 px-6 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-all"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const comingSoon = isComingSoonEvent(event);
  const publishLabel = comingSoon ? formatLaunchDate(event.publish_at) : "";
  const canonicalUrl = `${SITE_URL}/events/${event.id}`;
  const metaTitle = `${event.title} | Uni Deals Events`;
  const metaDescription = (
    event.description ||
    `Join ${event.title}, a student event in Sri Lanka${event.university_name ? ` hosted by ${event.university_name}` : ""}. Discover more student events on Uni Deals.`
  ).slice(0, 300);
  const ogImage = event.cover_image_url || DEFAULT_OG_IMAGE;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12 animate-fade-in">
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Uni Deals" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>

      <EventSchema event={event} canonicalUrl={canonicalUrl} />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Events", url: `${SITE_URL}/events` },
          { name: event.title, url: canonicalUrl },
        ]}
      />

      <button
        onClick={() => navigate('/events')}
        className="text-on-surface-variant/70 hover:text-on-background transition-colors cursor-pointer inline-flex items-center gap-1 mb-6 text-sm font-bold tracking-wider"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Events
      </button>

      <div className="bg-surface rounded-3xl border border-outline-variant/20 overflow-hidden shadow-sm flex flex-col md:flex-row">
        {/* Left Side: Image */}
        <div className="w-full md:w-2/5 h-64 md:h-auto relative bg-surface-container-high border-b md:border-b-0 md:border-r border-outline-variant/20">
          {event.cover_image_url ? (
            <img 
              src={event.cover_image_url} 
              alt={event.title} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-primary-container/20 text-primary/40">
              <span className="material-symbols-outlined text-6xl mb-2">image</span>
              <span className="text-sm font-bold tracking-widest uppercase">No Image</span>
            </div>
          )}
          {comingSoon && (
            <div className="absolute top-4 left-4 bg-sky-600 text-white px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Coming Soon</span>
            </div>
          )}
        </div>

        {/* Right Side: Content */}
        <div className="w-full md:w-3/5 p-6 md:p-10 flex flex-col">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase bg-primary/10 px-3 py-1.5 rounded-lg">
              {event.category || 'Event'}
            </span>
            {comingSoon && (
              <span className="text-xs font-bold tracking-[0.1em] text-sky-700 uppercase bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-lg">
                Coming Soon
              </span>
            )}
            {event.university_name && (
              <span className="text-xs font-bold tracking-[0.1em] text-on-surface-variant uppercase bg-surface-container-high border border-outline-variant/20 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">school</span>
                {event.university_name}
              </span>
            )}
            {event.club_name && (
              <span className="text-xs font-bold tracking-[0.1em] text-on-surface-variant uppercase bg-surface-container-high border border-outline-variant/20 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">group</span>
                {event.club_name}
              </span>
            )}
          </div>

          <h1 className="font-headline font-extrabold text-3xl md:text-4xl text-on-background mb-4 leading-tight">
            {event.title}
          </h1>

          {comingSoon && (
            <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              {publishLabel
                ? `This listing unlocks on ${publishLabel}. Registration opens then.`
                : "This listing is not fully live yet. Registration opens at go-live."}
            </div>
          )}

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-primary">schedule</span>
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">When</p>
                <p className="text-on-background font-medium">{formatDateTime(event.start_time)}</p>
                {event.end_time && (
                  <p className="text-on-surface-variant text-sm mt-0.5">to {formatDateTime(event.end_time)}</p>
                )}
              </div>
            </div>

            {event.location_name && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-container/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-primary">location_on</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">Where</p>
                  <p className="text-on-background font-medium">{event.location_name}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-primary">visibility</span>
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">Who Can Attend</p>
                <p className="text-on-background font-medium capitalize">{(event.target_audience || 'all_students').replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-headline font-bold text-on-background mb-3">About this Event</h2>
            <p className="text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {event.description}
            </p>
          </div>

          <div className="mt-auto pt-6 border-t border-outline-variant/20">
            {comingSoon ? (
              <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-sky-50 border border-sky-200 text-sky-800 font-bold rounded-xl cursor-not-allowed">
                <span className="material-symbols-outlined text-[18px]">lock</span>
                Registration unlocks at go-live
              </div>
            ) : event.external_registration_url ? (
              <a 
                href={event.external_registration_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm hover:shadow"
              >
                Register Now
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              </a>
            ) : (
              <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-surface-container border border-outline-variant/30 text-on-surface-variant font-bold rounded-xl cursor-not-allowed">
                No Registration Link
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
