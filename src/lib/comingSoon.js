/**
 * Helpers for Coming Soon / scheduled launch UX.
 */

export function isComingSoonDeal(deal) {
  if (!deal) return false;
  if (typeof deal.isComingSoon === "boolean") return deal.isComingSoon;
  if (typeof deal.is_coming_soon === "boolean") return deal.is_coming_soon;
  const start = deal.startTime || deal.start_time;
  if (!start) return false;
  const t = new Date(start);
  return !Number.isNaN(t.getTime()) && t.getTime() > Date.now();
}

/** True when the deal has ended. Prefers RPC is_expired so hidden end dates still wall. */
export function isExpiredDeal(deal) {
  if (!deal) return false;
  if (typeof deal.isExpired === "boolean") return deal.isExpired;
  if (typeof deal.is_expired === "boolean") return deal.is_expired;
  const end = deal.endTime || deal.end_time;
  if (!end) return false;
  const t = new Date(end);
  return !Number.isNaN(t.getTime()) && t.getTime() < Date.now();
}

/**
 * Portal catalogue rule: paused stays paused even after end_time.
 * Otherwise matches isExpiredDeal / status === "expired".
 */
export function isFinishedDeal(deal) {
  if (!deal) return false;
  const st = String(deal.db_status || deal.status || "");
  if (st === "paused") return false;
  if (st === "expired") return true;
  return isExpiredDeal(deal);
}

/**
 * Time-based deal status for admin/partner lists.
 * paused | scheduled | finished | active | pending | rejected | …
 */
export function getDealComputedStatus(deal, now = new Date()) {
  if (!deal) return "pending";
  const st = String(deal.db_status || deal.status || "pending");
  if (st === "paused") return "paused";
  if (st === "expired" || isExpiredDeal(deal)) return "finished";
  if (st === "active" || st === "approved") {
    const start = deal.start_time || deal.startTime;
    const startDate = start ? new Date(start) : new Date(0);
    if (!Number.isNaN(startDate.getTime()) && startDate > now) {
      return "scheduled";
    }
    return "active";
  }
  return st;
}

export function formatDealStatusLabel(status) {
  if (status === "finished" || status === "expired") return "Finished";
  return status || "pending";
}

export function isComingSoonEvent(event) {
  if (!event) return false;
  const publishAt = event.publish_at || event.publishAt;
  if (!publishAt) return false;
  const t = new Date(publishAt);
  return !Number.isNaN(t.getTime()) && t.getTime() > Date.now();
}

/** Past event: end_time has passed, or no end_time and start was ≥ 24h ago. Coming Soon is never finished. */
export function isFinishedEvent(event, now = new Date()) {
  if (!event) return false;
  if (isComingSoonEvent(event)) return false;
  const start = event.start_time || event.startTime;
  if (!start) return false;
  const startTime = new Date(start);
  if (Number.isNaN(startTime.getTime())) return false;
  if (startTime > now) return false;
  const endRaw = event.end_time || event.endTime;
  const endTime = endRaw ? new Date(endRaw) : null;
  if (endTime && !Number.isNaN(endTime.getTime())) {
    return endTime.getTime() <= now.getTime();
  }
  return now.getTime() - startTime.getTime() >= 24 * 60 * 60 * 1000;
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
  const finished = [];
  for (const deal of deals || []) {
    if (isComingSoonDeal(deal)) comingSoon.push(deal);
    else if (isFinishedDeal(deal)) finished.push(deal);
    else live.push(deal);
  }
  return { live, comingSoon: sortComingSoonDeals(comingSoon), finished };
}

/**
 * Split approved events into live listings vs Coming Soon vs finished (past).
 * Coming Soon is sorted nearest publish first.
 */
export function partitionEvents(events) {
  const live = [];
  const comingSoon = [];
  const finished = [];
  for (const event of events || []) {
    if (isComingSoonEvent(event)) comingSoon.push(event);
    else if (isFinishedEvent(event)) finished.push(event);
    else live.push(event);
  }
  return { live, comingSoon: sortComingSoonEvents(comingSoon), finished };
}
