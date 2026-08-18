/**
 * Helpers for Coming Soon / scheduled launch UX.
 */

export function isComingSoonDeal(deal) {
  if (!deal) return false;
  if (typeof deal.isComingSoon === "boolean") return deal.isComingSoon;
  const start = deal.startTime || deal.start_time;
  if (!start) return false;
  const t = new Date(start);
  return !Number.isNaN(t.getTime()) && t.getTime() > Date.now();
}

/** True when the deal's end time is in the past. */
export function isExpiredDeal(deal) {
  if (!deal) return false;
  const end = deal.endTime || deal.end_time;
  if (!end) return false;
  const t = new Date(end);
  return !Number.isNaN(t.getTime()) && t.getTime() < Date.now();
}

export function isComingSoonEvent(event) {
  if (!event) return false;
  const publishAt = event.publish_at || event.publishAt;
  if (!publishAt) return false;
  const t = new Date(publishAt);
  return !Number.isNaN(t.getTime()) && t.getTime() > Date.now();
}

export function formatLaunchDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Punchy launch copy for cards — relative when soon, short date otherwise.
 * e.g. "Opens today", "Opens tomorrow", "Opens in 2 days", "Available Aug 12"
 */
export function formatLaunchRelative(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfLaunch = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayDiff = Math.round(
    (startOfLaunch.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (dayDiff <= 0) return "Opens today";
  if (dayDiff === 1) return "Opens tomorrow";
  if (dayDiff <= 7) return `Opens in ${dayDiff} days`;

  return `Available ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

/** Convert ISO / Date to value for <input type="datetime-local"> */
export function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dealLaunchMs(deal) {
  const start = deal?.startTime || deal?.start_time;
  const t = start ? new Date(start).getTime() : NaN;
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function eventPublishMs(event) {
  const publishAt = event?.publish_at || event?.publishAt;
  const t = publishAt ? new Date(publishAt).getTime() : NaN;
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** Nearest launch first */
export function sortComingSoonDeals(deals) {
  return [...(deals || [])].sort((a, b) => dealLaunchMs(a) - dealLaunchMs(b));
}

/** Nearest publish_at first */
export function sortComingSoonEvents(events) {
  return [...(events || [])].sort(
    (a, b) => eventPublishMs(a) - eventPublishMs(b),
  );
}

export function partitionDeals(deals) {
  const live = [];
  const comingSoon = [];
  for (const deal of deals || []) {
    if (isComingSoonDeal(deal)) comingSoon.push(deal);
    else live.push(deal);
  }
  return { live, comingSoon: sortComingSoonDeals(comingSoon) };
}

/**
 * Split approved events into live listings vs Coming Soon (future publish_at).
 * Coming Soon is sorted nearest publish first.
 */
export function partitionEvents(events) {
  const live = [];
  const comingSoon = [];
  for (const event of events || []) {
    if (isComingSoonEvent(event)) comingSoon.push(event);
    else live.push(event);
  }
  return { live, comingSoon: sortComingSoonEvents(comingSoon) };
}
