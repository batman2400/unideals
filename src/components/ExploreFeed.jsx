/**
 * ExploreFeed — short discovery feed on Home.
 *
 * Trending Deals → Trending Events → Coming Soon Deals → Coming Soon Events.
 * Full catalogs live on /deals and /events (View all links).
 */
import { Link } from "react-router-dom";
import { useMemo } from "react";
import DealCard from "./DealCard";
import DealGrid from "./DealGrid";
import DealsLoader from "./DealsLoader";
import { EventCardCompact } from "./EventCard";
import { useDeals, useSavedDealIds } from "../lib/useDeals";
import { useEvents } from "../lib/useEvents";
import { partitionDeals, partitionEvents } from "../lib/comingSoon";

const PREVIEW_LIMIT = 6;

function HorizontalDealRow({ deals, savedIds, toggleSave, savedLoading }) {
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-6 md:gap-4 md:px-8 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {deals.map((deal) => (
        <div
          key={deal.id}
          className="w-[58vw] max-w-[280px] flex-shrink-0 sm:w-56 md:w-64"
        >
          <DealCard
            deal={deal}
            variant="hero"
            isSaved={savedIds ? savedIds.has(deal.id) : undefined}
            onToggleSave={toggleSave}
            savedLoading={savedLoading}
          />
        </div>
      ))}
    </div>
  );
}

function HorizontalEventRow({ events }) {
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-6 md:gap-4 md:px-8 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {events.map((event) => (
        <div
          key={event.id}
          className="w-[58vw] max-w-[280px] flex-shrink-0 sm:w-56 md:w-64"
        >
          <EventCardCompact event={event} />
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ title, subtitle, to, linkLabel = "View all →" }) {
  return (
    <div className="px-4 md:px-8 mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-headline font-extrabold text-xl tracking-tight md:text-2xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
        ) : null}
      </div>
      {to ? (
        <Link
          to={to}
          className="font-headline text-sm font-bold text-on-surface-variant transition-colors hover:text-primary shrink-0"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

function getActiveEvents(liveEvents) {
  const now = new Date();
  const active = [];

  for (const event of liveEvents) {
    const startTime = new Date(event.start_time);
    const endTime = event.end_time ? new Date(event.end_time) : null;

    const isUpcoming = startTime > now;
    const isOngoing = endTime && endTime > now;
    const isRecentNoEnd =
      !endTime && now - startTime < 24 * 60 * 60 * 1000;

    if (isUpcoming || isOngoing || isRecentNoEnd) {
      active.push(event);
    }
  }

  active.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  return active;
}

function ExploreFeed({ searchQuery = "" }) {
  const {
    deals,
    loading: dealsLoading,
    error: dealsError,
  } = useDeals();
  const {
    events,
    loading: eventsLoading,
    error: eventsError,
  } = useEvents();
  const { savedIds, toggleSave, savedLoading } = useSavedDealIds();

  const normalizedQuery = searchQuery.toLowerCase().trim();
  const isSearching = !!normalizedQuery;

  const filteredDeals = useMemo(() => {
    if (!normalizedQuery) return deals;
    return deals.filter(
      (deal) =>
        deal.title?.toLowerCase().includes(normalizedQuery) ||
        deal.brand?.toLowerCase().includes(normalizedQuery) ||
        deal.category?.toLowerCase().includes(normalizedQuery),
    );
  }, [deals, normalizedQuery]);

  const filteredEvents = useMemo(() => {
    if (!normalizedQuery) return events;
    return events.filter(
      (event) =>
        event.title?.toLowerCase().includes(normalizedQuery) ||
        event.category?.toLowerCase().includes(normalizedQuery) ||
        event.university_name?.toLowerCase().includes(normalizedQuery) ||
        event.location_name?.toLowerCase().includes(normalizedQuery) ||
        event.description?.toLowerCase().includes(normalizedQuery),
    );
  }, [events, normalizedQuery]);

  const { live: liveDeals, comingSoon: comingSoonDeals } = useMemo(
    () => partitionDeals(filteredDeals),
    [filteredDeals],
  );

  const { live: liveEvents, comingSoon: comingSoonEvents } = useMemo(
    () => partitionEvents(filteredEvents),
    [filteredEvents],
  );

  const activeEvents = useMemo(
    () => getActiveEvents(liveEvents),
    [liveEvents],
  );

  const loading = dealsLoading || eventsLoading;
  const error = dealsError || eventsError;

  if (loading || error) {
    return <DealsLoader loading={loading} error={error || dealsError} />;
  }

  const trendingDeals = liveDeals.slice(0, PREVIEW_LIMIT);
  const trendingEvents = activeEvents.slice(0, PREVIEW_LIMIT);
  const previewComingSoonDeals = comingSoonDeals.slice(0, PREVIEW_LIMIT);
  const previewComingSoonEvents = comingSoonEvents.slice(0, PREVIEW_LIMIT);

  if (isSearching) {
    return (
      <div className="max-w-[1440px] mx-auto pb-16 space-y-10 px-4 md:px-8 pt-6">
        <section>
          <div className="mb-6">
            <h2 className="font-headline font-extrabold text-2xl tracking-tight md:text-3xl">
              Search Results
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {liveDeals.length} deal{liveDeals.length !== 1 ? "s" : ""} ·{" "}
              {activeEvents.length} event
              {activeEvents.length !== 1 ? "s" : ""}
            </p>
          </div>

          {liveDeals.length > 0 && (
            <div className="mb-10">
              <h3 className="font-headline font-bold text-lg mb-4">Deals</h3>
              <DealGrid
                deals={liveDeals}
                enableStagger
                savedIds={savedIds}
                onToggleSave={toggleSave}
                savedLoading={savedLoading}
              />
            </div>
          )}

          {activeEvents.length > 0 && (
            <div className="mb-10">
              <h3 className="font-headline font-bold text-lg mb-4">Events</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {activeEvents.map((event) => (
                  <EventCardCompact key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}

          {liveDeals.length === 0 && activeEvents.length === 0 && (
            <p className="text-sm text-on-surface-variant">
              No current deals or events match your search.
            </p>
          )}
        </section>

        {(comingSoonDeals.length > 0 || comingSoonEvents.length > 0) && (
          <section className="space-y-10">
            {comingSoonDeals.length > 0 && (
              <div>
                <h2 className="font-headline font-extrabold text-2xl tracking-tight md:text-3xl mb-2">
                  Coming Soon Deals
                </h2>
                <p className="mb-6 text-sm text-on-surface-variant">
                  {comingSoonDeals.length} upcoming · nearest launch first
                </p>
                <DealGrid
                  deals={comingSoonDeals}
                  enableStagger
                  savedIds={savedIds}
                  onToggleSave={toggleSave}
                  savedLoading={savedLoading}
                />
              </div>
            )}
            {comingSoonEvents.length > 0 && (
              <div>
                <h2 className="font-headline font-extrabold text-2xl tracking-tight md:text-3xl mb-2">
                  Coming Soon Events
                </h2>
                <p className="mb-6 text-sm text-on-surface-variant">
                  {comingSoonEvents.length} upcoming · nearest go-live first
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {comingSoonEvents.map((event) => (
                    <EventCardCompact key={event.id} event={event} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    );
  }

  const hasAny =
    trendingDeals.length > 0 ||
    trendingEvents.length > 0 ||
    previewComingSoonDeals.length > 0 ||
    previewComingSoonEvents.length > 0;

  return (
    <div className="max-w-[1440px] mx-auto pb-16">
      {!hasAny ? (
        <p className="px-4 md:px-8 pt-8 text-sm text-on-surface-variant">
          Nothing to explore yet — check back soon.
        </p>
      ) : (
        <>
          {trendingDeals.length > 0 && (
            <section className="pt-4 pb-2">
              <SectionHeader title="Trending Deals" to="/deals" />
              <HorizontalDealRow
                deals={trendingDeals}
                savedIds={savedIds}
                toggleSave={toggleSave}
                savedLoading={savedLoading}
              />
            </section>
          )}

          {trendingEvents.length > 0 && (
            <section className="border-t border-outline-variant/10 pt-6 pb-2">
              <SectionHeader title="Trending Events" to="/events" />
              <HorizontalEventRow events={trendingEvents} />
            </section>
          )}

          {previewComingSoonDeals.length > 0 && (
            <section className="border-t border-outline-variant/10 pt-6 pb-2">
              <SectionHeader
                title="Coming Soon Deals"
                subtitle="Launching soon · nearest first"
                to="/deals"
              />
              <HorizontalDealRow
                deals={previewComingSoonDeals}
                savedIds={savedIds}
                toggleSave={toggleSave}
                savedLoading={savedLoading}
              />
            </section>
          )}

          {previewComingSoonEvents.length > 0 && (
            <section className="border-t border-outline-variant/10 pt-6 pb-2">
              <SectionHeader
                title="Coming Soon Events"
                subtitle="Listings that unlock soon · nearest first"
                to="/events"
              />
              <HorizontalEventRow events={previewComingSoonEvents} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default ExploreFeed;
