import { Link } from "react-router-dom";
import {
  formatLaunchDate,
  isComingSoonEvent,
  isFinishedEvent,
} from "../lib/comingSoon";

function formatDateTime(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getEventStatus(event) {
  const now = new Date();
  const startTime = new Date(event.start_time);
  const endTime = event.end_time ? new Date(event.end_time) : null;

  if (isComingSoonEvent(event)) return "coming soon";
  if (isFinishedEvent(event, now)) return "past";
  if (startTime > now) return null;
  if (endTime && endTime > now) return "happening now";
  if (!endTime && now - startTime < 24 * 60 * 60 * 1000) return "happening now";
  return "past";
}

/**
 * Compact card for horizontal explore rows.
 */
export function EventCardCompact({ event }) {
  const status = getEventStatus(event);
  const publishLabel =
    status === "coming soon" ? formatLaunchDate(event.publish_at) : "";

  return (
    <Link
      to={`/events/${event.id}`}
      className={`block w-full bg-surface rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group ${
        status === "past" ? "opacity-75" : ""
      }`}
    >
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-high">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt={event.title}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out ${
              status === "past" ? "grayscale-[30%]" : ""
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-surface to-primary/5">
            <span className="material-symbols-outlined text-4xl text-primary/30 mb-1">
              event
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3 bg-surface/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 shadow-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px] text-primary">
            calendar_month
          </span>
          <span className="text-[11px] font-bold text-on-surface">
            {new Date(event.start_time).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        {status === "coming soon" && (
          <div className="absolute top-3 right-3 bg-sky-600 text-white px-2 py-1 rounded-lg shadow-sm">
            <span className="text-[9px] font-bold uppercase tracking-wider">
              Coming Soon
            </span>
          </div>
        )}
        {status === "happening now" && (
          <div className="absolute top-3 right-3 bg-emerald-500 text-white px-2 py-1 rounded-lg shadow-sm flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span className="text-[9px] font-bold uppercase tracking-wider">
              Live
            </span>
          </div>
        )}
      </div>
      <div className="p-3.5">
        <p className="text-[10px] font-bold tracking-[0.15em] text-primary uppercase mb-1.5">
          {event.category || "Event"}
        </p>
        <h3 className="font-headline font-extrabold text-base text-on-background line-clamp-2 leading-tight mb-1">
          {event.title}
        </h3>
        {status === "coming soon" && publishLabel ? (
          <p className="text-xs text-sky-700 line-clamp-1">
            Unlocks {publishLabel}
          </p>
        ) : event.location_name ? (
          <p className="text-xs text-on-surface-variant line-clamp-1">
            {event.location_name}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export default function EventCard({ event }) {
  const status = getEventStatus(event);
  const publishLabel =
    status === "coming soon" ? formatLaunchDate(event.publish_at) : "";

  return (
    <Link
      to={`/events/${event.id}`}
      className={`w-full max-w-sm sm:max-w-none bg-surface rounded-3xl border border-outline-variant/20 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col ${
        status === "past" ? "opacity-75" : ""
      }`}
    >
      <div className="relative w-full h-48 sm:h-56 overflow-hidden bg-surface-container-high">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt={event.title}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out ${
              status === "past" ? "grayscale-[30%]" : ""
            }`}
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
          <span className="material-symbols-outlined text-[16px] text-primary">
            calendar_month
          </span>
          <span className="text-xs font-bold text-on-surface">
            {new Date(event.start_time).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        {status === "coming soon" && (
          <div className="absolute top-4 right-4 bg-sky-600 text-white px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">
              schedule
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Coming Soon
            </span>
          </div>
        )}
        {status === "happening now" && (
          <div className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Live Now
            </span>
          </div>
        )}
        {status === "past" && (
          <div className="absolute top-4 right-4 bg-on-surface/70 text-white px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">
              history
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Past Event
            </span>
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-grow">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase bg-primary/10 px-2.5 py-1 rounded-md">
              {event.category || "Event"}
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
            <span className="material-symbols-outlined text-[18px]">
              schedule
            </span>
            <span>{formatDateTime(event.start_time)}</span>
          </div>
          {status === "coming soon" && publishLabel && (
            <div className="flex items-center gap-2 text-sm text-sky-700">
              <span className="material-symbols-outlined text-[18px]">
                rocket_launch
              </span>
              <span>Listing unlocks {publishLabel}</span>
            </div>
          )}
          {event.location_name && (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">
                location_on
              </span>
              <span className="line-clamp-1">{event.location_name}</span>
            </div>
          )}
        </div>

        <span className="w-full py-3.5 rounded-xl font-headline font-bold text-sm flex items-center justify-center gap-2 transition-all bg-surface-container border border-outline-variant/20 text-on-surface group-hover:bg-primary group-hover:text-on-primary group-hover:border-primary group-hover:shadow-md">
          {status === "coming soon" ? "Preview Event" : "View Event Details"}
          <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </span>
      </div>
    </Link>
  );
}
