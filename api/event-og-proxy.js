/**
 * Server-rendered Open Graph & Schema.org proxy for /events/:id
 *
 * Serves fully prerendered HTML to search engines (Googlebot, Bingbot, ...)
 * and social preview bots (WhatsApp, Telegram, Facebook, Twitter, Slack, ...)
 * and AI answer engines (ChatGPT, Perplexity, Claude).
 *
 * Emits Event JSON-LD schema matching client EventSchema, canonical, Open Graph,
 * 404 with noindex for invalid/unapproved/finished events, and a rich indexable HTML body.
 */
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SITE_URL = "https://www.unideals.co";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function offerValidFrom(event) {
  const fromCreated = toIsoDate(event.created_at);
  if (fromCreated) return fromCreated;

  const start = event.start_time ? new Date(event.start_time) : null;
  if (start && !Number.isNaN(start.getTime())) {
    start.setDate(start.getDate() - 30);
    return start.toISOString();
  }

  return new Date().toISOString();
}

export function isComingSoonEvent(event) {
  if (!event) return false;
  const publishAt = event.publish_at || event.publishAt;
  if (!publishAt) return false;
  const t = new Date(publishAt);
  return !Number.isNaN(t.getTime()) && t.getTime() > Date.now();
}

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

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || typeof id !== "string" || !UUID_REGEX.test(id.trim())) {
    res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(notFoundHtml());
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(notFoundHtml());
  }

  try {
    const query = new URL(`${supabaseUrl}/rest/v1/events`);
    query.searchParams.set("id", `eq.${id.trim()}`);
    query.searchParams.set("status", "eq.approved");
    query.searchParams.set("select", "*");

    const eventRes = await fetch(query, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!eventRes.ok) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(notFoundHtml());
    }

    const events = await eventRes.json();
    const event = Array.isArray(events) ? events[0] : null;

    if (!event || isFinishedEvent(event)) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(notFoundHtml());
    }

    const canonicalUrl = `${SITE_URL}/events/${event.id}`;
    const rawTitle = `${event.title} | Student Events in Sri Lanka | Uni Deals`;
    const rawDescription =
      event.description ||
      `${event.title} organized by ${event.club_name || event.university_name || "students"} in Sri Lanka — discover campus events on Uni Deals.`;
    const rawImage = event.cover_image_url || DEFAULT_IMAGE;

    const title = escapeHtml(rawTitle);
    const description = escapeHtml(rawDescription);
    const image = escapeHtml(rawImage);
    const organizerName = event.club_name || event.university_name || "Uni Deals";
    const organizerUrl = event.organizer_url || event.external_registration_url || canonicalUrl;

    const location = event.location_name
      ? {
          "@type": "Place",
          "name": event.location_name,
          "address": event.location_name,
        }
      : {
          "@type": "VirtualLocation",
          "url": canonicalUrl,
        };

    const schema = {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": event.title,
      "description": rawDescription,
      "startDate": event.start_time,
      ...(event.end_time ? { "endDate": event.end_time } : {}),
      "eventAttendanceMode": event.location_name
        ? "https://schema.org/OfflineEventAttendanceMode"
        : "https://schema.org/OnlineEventAttendanceMode",
      "eventStatus": "https://schema.org/EventScheduled",
      "image": [rawImage],
      "url": canonicalUrl,
      "location": location,
      "organizer": {
        "@type": "Organization",
        "name": organizerName,
        "url": organizerUrl,
      },
      "performer": {
        "@type": "Organization",
        "name": organizerName,
      },
      "offers": {
        "@type": "Offer",
        "url": event.external_registration_url || canonicalUrl,
        "availability": "https://schema.org/InStock",
        "price": "0",
        "priceCurrency": "LKR",
        "validFrom": offerValidFrom(event),
      },
    };

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="event" />
    <meta property="og:site_name" content="Uni Deals" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="en_LK" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
  </head>
  <body>
    <article>
      <header>
        <p><strong>Organizer:</strong> ${escapeHtml(organizerName)}</p>
        <p><strong>Location:</strong> ${escapeHtml(event.location_name || "Online / Virtual")}</p>
        <h1>${title}</h1>
      </header>
      <section>
        <p><strong>Event Schedule:</strong> ${escapeHtml(event.start_time || "See details")} ${event.end_time ? "to " + escapeHtml(event.end_time) : ""}</p>
        <p>${description}</p>
      </section>
      <nav aria-label="Related links">
        <ul>
          <li><a href="${SITE_URL}/events">All Student Events</a></li>
          <li><a href="${SITE_URL}/deals">Student Deals in Sri Lanka</a></li>
          <li><a href="${SITE_URL}">Uni Deals Homepage</a></li>
        </ul>
      </nav>
    </article>
  </body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    res.status(200).send(html);
  } catch (error) {
    console.error("event-og-proxy error:", error);
    res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(notFoundHtml());
  }
}

export function notFoundHtml() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Event Not Found | Uni Deals</title>
    <meta name="robots" content="noindex, nofollow" />
    <meta property="og:title" content="Event Not Found | Uni Deals" />
    <meta property="og:description" content="This event has ended or was not found." />
  </head>
  <body>
    <h1>Event Not Found</h1>
    <p>This student event has concluded or is no longer listed on Uni Deals.</p>
    <p><a href="${SITE_URL}/events">Browse upcoming student events in Sri Lanka</a></p>
  </body>
</html>`;
}
