/**
 * EventSchema — schema.org Event structured data for /events/:id.
 *
 * Lets Google render campus events with rich results (date, location,
 * registration link) in Search.
 */
const SITE_URL = "https://www.unideals.co";

export default function EventSchema({ event, canonicalUrl }) {
  if (!event) return null;

  const location = event.location_name
    ? {
        "@type": "Place",
        name: event.location_name,
        address: event.location_name,
      }
    : {
        "@type": "VirtualLocation",
        url: canonicalUrl,
      };

  const schema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || `${event.title} — a student event on Uni Deals.`,
    startDate: event.start_time,
    ...(event.end_time ? { endDate: event.end_time } : {}),
    eventAttendanceMode: event.location_name
      ? "https://schema.org/OfflineEventAttendanceMode"
      : "https://schema.org/OnlineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: [event.cover_image_url || `${SITE_URL}/icon-512-v5.png`],
    url: canonicalUrl,
    location,
    organizer: {
      "@type": "Organization",
      name: event.club_name || event.university_name || "Uni Deals",
    },
    offers: {
      "@type": "Offer",
      url: event.external_registration_url || canonicalUrl,
      availability: "https://schema.org/InStock",
      price: "0",
      priceCurrency: "LKR",
    },
  };

  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
}
