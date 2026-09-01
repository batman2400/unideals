import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { partitionEvents } from "../lib/comingSoon";
import { useEvents } from "../lib/useEvents";
import { SITE_URL, DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_WIDTH, DEFAULT_OG_IMAGE_HEIGHT } from "../lib/seo";
import EventCard from "../components/EventCard";
import ItemListSchema from "../components/ItemListSchema";

const scheduleTabs = [
  { label: "All", value: "all" },
  { label: "Live", value: "current" },
  { label: "Coming Soon", value: "coming_soon" },
];

export default function UniversityEvents() {
  const { events: allEvents, loading, error, refetch } = useEvents();
  const [scheduleTab, setScheduleTab] = useState("all");

  const { live: liveEvents, comingSoon: comingSoonEvents } = useMemo(
    () => partitionEvents(allEvents),
    [allEvents],
  );

  const activeEvents = useMemo(() => {
    return [...liveEvents].sort(
      (a, b) => new Date(a.start_time) - new Date(b.start_time),
    );
  }, [liveEvents]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 animate-fade-in">
      <Helmet>
        <title>Student Events in Sri Lanka | Uni Deals</title>
        <meta
          name="description"
          content="Discover university events, tech fests, networking sessions, and society gatherings across Sri Lanka. Submit your own campus event for free on Uni Deals."
        />
        <link rel="canonical" href={`${SITE_URL}/events`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Uni Deals" />
        <meta property="og:title" content="Student Events in Sri Lanka | Uni Deals" />
        <meta
          property="og:description"
          content="Discover university events, tech fests, networking sessions, and society gatherings across Sri Lanka."
        />
        <meta property="og:url" content={`${SITE_URL}/events`} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta property="og:image:width" content={DEFAULT_OG_IMAGE_WIDTH} />
        <meta property="og:image:height" content={DEFAULT_OG_IMAGE_HEIGHT} />
      </Helmet>

      {activeEvents.length > 0 && (
        <ItemListSchema
          name="Upcoming Student Events in Sri Lanka"
          items={activeEvents.map((event) => ({
            name: event.title,
            url: `${SITE_URL}/events/${event.id}`,
          }))}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background">
            Events
          </h1>
          <p className="text-on-surface-variant text-base mt-2 max-w-2xl">
            Discover exclusive networking sessions, tech fests, and social
            gatherings on campus.
          </p>
        </div>
        <Link
          to="/events/new"
          className="inline-flex items-center justify-center gap-1.5 px-5 py-3 bg-primary text-on-primary hover:bg-primary/90 font-headline font-bold text-sm rounded-xl transition-all shadow-sm active:scale-[0.98] self-start sm:self-center"
        >
          <span className="material-symbols-outlined text-[20px]">
            add_circle
          </span>
          Submit an Event
        </Link>
      </div>

      {!loading && !error && allEvents.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {scheduleTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setScheduleTab(tab.value)}
              className={`px-5 py-2.5 rounded-xl text-sm font-headline font-bold tracking-tight transition-all border ${
                scheduleTab === tab.value
                  ? tab.value === "coming_soon"
                    ? "bg-sky-600 text-white border-sky-600 shadow-md"
                    : "bg-primary text-on-primary border-primary shadow-md"
                  : "bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 opacity-80 font-normal">
                (
                {tab.value === "coming_soon"
                  ? comingSoonEvents.length
                  : tab.value === "current"
                    ? liveEvents.length
                    : allEvents.length}
                )
              </span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-surface rounded-3xl border border-outline-variant/20 overflow-hidden shadow-sm animate-pulse"
            >
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
          <span className="material-symbols-outlined text-error text-3xl mb-2">
            error
          </span>
          <p className="text-error font-bold">{error}</p>
          <button
            onClick={refetch}
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
            We are currently partnering with university societies to bring you
            the best events. Check back soon!
          </p>
        </div>
      ) : scheduleTab === "coming_soon" ? (
        <div>
          {comingSoonEvents.length > 0 ? (
            <>
              <h2 className="font-headline font-bold text-xl text-on-background mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-600">
                  schedule
                </span>
                Coming Soon
                <span className="text-sm font-normal text-on-surface-variant ml-1">
                  ({comingSoonEvents.length})
                </span>
              </h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Listings that unlock soon · nearest go-live first
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 justify-items-center sm:justify-items-stretch">
                {comingSoonEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </>
          ) : (
            <div className="bg-surface-container-low border border-outline-variant/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="w-20 h-20 rounded-full bg-sky-50 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-sky-600 text-4xl">
                  schedule
                </span>
              </div>
              <h2 className="font-headline font-bold text-2xl text-on-background mb-3">
                No coming soon events
              </h2>
              <p className="text-on-surface-variant text-base max-w-md">
                Scheduled listings will appear here until their go-live date.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-12">
          {scheduleTab === "all" && comingSoonEvents.length > 0 && (
            <div>
              <h2 className="font-headline font-bold text-xl text-on-background mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-600">
                  schedule
                </span>
                Coming Soon
                <span className="text-sm font-normal text-on-surface-variant ml-1">
                  ({comingSoonEvents.length})
                </span>
              </h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Nearest go-live first
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 justify-items-center sm:justify-items-stretch">
                {comingSoonEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}

          {activeEvents.length > 0 ? (
            <div>
              <h2 className="font-headline font-bold text-xl text-on-background mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  event_available
                </span>
                Upcoming & Ongoing
                <span className="text-sm font-normal text-on-surface-variant ml-1">
                  ({activeEvents.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 justify-items-center sm:justify-items-stretch">
                {activeEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
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
                {scheduleTab === "all" && comingSoonEvents.length > 0
                  ? "Nothing live yet — Coming Soon listings are above."
                  : comingSoonEvents.length > 0
                    ? "Nothing live right now — check the Coming Soon or All tab."
                    : "No upcoming events right now. Check back soon!"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
