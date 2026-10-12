import type { CandidateEventInput } from "@/types/event";
import { canonicalCity } from "../cities";
import { extractLdEvents, ldFormat, ldImage, ldOrganiser, ldPlace, ldPrice, stripQuery } from "./jsonld";
import { type Connector, errMsg, fetchText } from "./types";

/**
 * Meetup's public "find" pages publish schema.org Event data (JSON LD).
 * Category 405 is Meetup's "Career & Business" category.
 */
const CATEGORY_IDS = ["405"];

export const meetup: Connector = {
  name: "Meetup",
  method: "schema.org JSON LD on public city event-search pages",
  async fetch({ cities, windowEnd }) {
    const candidates: CandidateEventInput[] = [];
    const errors: string[] = [];
    for (const city of cities) {
      for (const cat of CATEGORY_IDS) {
        const listUrl = `https://www.meetup.com/find/?location=${encodeURIComponent(city.meetup)}&source=EVENTS&categoryId=${cat}`;
        try {
          const evs = extractLdEvents(await fetchText(listUrl));
          if (evs.length === 0) errors.push(`${city.name}: no structured events found on page`);
          for (const ev of evs) {
            if (!ev.url || !ev.name || !ev.startDate) continue;
            if (ev.eventStatus && /Cancelled/i.test(ev.eventStatus)) continue;
            const startAt = new Date(ev.startDate);
            if (Number.isNaN(startAt.getTime()) || startAt > windowEnd) continue;
            const endAt = ev.endDate ? new Date(ev.endDate) : null;
            const place = ldPlace(ev);
            const url = stripQuery(ev.url);
            candidates.push({
              sourceName: "Meetup",
              sourceEventId: url.match(/\/events\/(\d+)/)?.[1] ?? url,
              sourceUrl: url,
              title: ev.name,
              description: ev.description ?? null,
              startAt,
              endAt: endAt && !Number.isNaN(endAt.getTime()) ? endAt : null,
              allDay: false,
              timezone: null,
              venue: place.venue,
              city: canonicalCity(place.city),
              country: place.country,
              format: ldFormat(ev.eventAttendanceMode),
              organiser: ldOrganiser(ev),
              eventUrl: url,
              registrationUrl: url,
              statedDeadline: null,
              registrationOpen: null,
              priceText: ldPrice(ev),
              imageUrl: ldImage(ev),
            });
          }
        } catch (e) {
          errors.push(`${city.name}: ${errMsg(e)}`);
        }
      }
    }
    return { candidates, errors };
  },
};
