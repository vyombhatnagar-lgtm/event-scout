import type { CandidateEventInput } from "@/types/event";
import { zonedMidnight } from "@/lib/time";
import { canonicalCity } from "../cities";
import { extractLdEvents, isDateOnly, ldFormat, ldOrganiser, ldPlace, ldPrice, stripQuery } from "./jsonld";
import { type Connector, errMsg, fetchText, sleep } from "./types";

/**
 * Eventbrite retired its public event-search API in 2020. Its public city/category
 * listing pages publish schema.org Event data (JSON-LD) for search engines; we read
 * that structured data only. Robots rules for these paths permit crawling.
 */
const CATEGORY_PATHS = ["business--events", "science-and-tech--events"];
const PAGES = 2;
const REQUEST_GAP_MS = 2_000;

const TZ_BY_COUNTRY: Record<string, string> = { IN: "Asia/Kolkata", SG: "Asia/Singapore", AE: "Asia/Dubai" };

export const eventbrite: Connector = {
  name: "Eventbrite",
  method: "schema.org JSON-LD on public city/category listing pages",
  async fetch({ cities, windowEnd }) {
    const candidates: CandidateEventInput[] = [];
    const errors: string[] = [];
    let requests = 0;
    for (const city of cities) {
      for (const cat of CATEGORY_PATHS) {
        for (let page = 1; page <= PAGES; page++) {
          const listUrl = `https://www.eventbrite.com/d/${city.eventbrite}/${cat}/${page > 1 ? `?page=${page}` : ""}`;
          if (requests++ > 0) await sleep(REQUEST_GAP_MS); // be a polite, low-volume client
          try {
            const evs = extractLdEvents(await fetchText(listUrl));
            if (evs.length === 0) {
              if (page === 1) errors.push(`${city.name}/${cat}: no structured events found on page`);
              break;
            }
            for (const ev of evs) {
              if (!ev.url || !ev.name || !ev.startDate) continue;
              const place = ldPlace(ev);
              // Listing pages mix in promoted events from other countries; keep only this city's country.
              if (place.country && place.country !== city.countryCode) continue;
              const tz = TZ_BY_COUNTRY[place.country ?? city.countryCode] ?? "Asia/Kolkata";
              const dateOnly = isDateOnly(ev.startDate);
              const startAt = dateOnly ? zonedMidnight(ev.startDate, tz) : new Date(ev.startDate);
              if (Number.isNaN(startAt.getTime()) || startAt > windowEnd) continue;
              let endAt: Date | null = null;
              if (ev.endDate) {
                endAt = isDateOnly(ev.endDate) ? new Date(zonedMidnight(ev.endDate, tz).getTime() + 86_399_000) : new Date(ev.endDate);
                if (Number.isNaN(endAt.getTime())) endAt = null;
              }
              const url = stripQuery(ev.url);
              const id = url.match(/-(\d{6,})\/?$/)?.[1] ?? url;
              candidates.push({
                sourceName: "Eventbrite",
                sourceEventId: id,
                sourceUrl: url,
                title: ev.name,
                description: ev.description ?? null,
                startAt,
                endAt,
                allDay: dateOnly,
                timezone: tz,
                venue: place.venue && !/^tba$/i.test(place.venue) ? place.venue : null,
                city: canonicalCity(place.city),
                country: place.country,
                format: ldFormat(ev.eventAttendanceMode),
                organiser: ldOrganiser(ev),
                eventUrl: url,
                registrationUrl: url,
                statedDeadline: null, // listing data does not state a registration deadline
                registrationOpen: null,
                priceText: ldPrice(ev),
              });
            }
          } catch (e) {
            errors.push(`${city.name}/${cat} p${page}: ${errMsg(e)}`);
            break;
          }
        }
      }
    }
    return { candidates, errors };
  },
};
