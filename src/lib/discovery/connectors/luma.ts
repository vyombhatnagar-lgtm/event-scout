import type { CandidateEventInput } from "@/types/event";
import { canonicalCity } from "../cities";
import { type Connector, errMsg, fetchJson, mapLimit } from "./types";

/**
 * Luma serves its public "Discover" listings (luma.com/discover) from a JSON endpoint
 * that needs no key. It is not a documented, versioned API, so every field is treated
 * as optional and a shape change surfaces as a run error rather than bad data.
 */
const API = "https://api.lu.ma";
const PAGE_SIZE = 50;
const MAX_PAGES = 3;
const MAX_DETAIL_FETCHES = 60;

interface LumaPlace {
  place: { api_id: string; slug?: string; name?: string };
}
interface LumaEntry {
  api_id: string;
  event: {
    api_id: string;
    name?: string;
    start_at?: string;
    end_at?: string;
    timezone?: string;
    url?: string;
    cover_url?: string;
    location_type?: string;
    visibility?: string;
    geo_address_info?: { city?: string; country_code?: string; address?: string; full_address?: string };
  };
  calendar?: { name?: string };
  hosts?: { name?: string }[];
  ticket_info?: { is_free?: boolean; price?: { cents?: number; currency?: string } | null; is_sold_out?: boolean };
  registration_availability?: string;
}
interface LumaDetail {
  description_mirror?: unknown;
  ticket_types?: { is_hidden?: boolean; is_disabled?: boolean; valid_end_at?: string | null }[];
}

let placeCache: Map<string, string> | null = null;

async function placeIds(): Promise<Map<string, string>> {
  if (placeCache) return placeCache;
  const boot = await fetchJson<{ places?: LumaPlace[] }>(`${API}/discover/bootstrap-page?featured_place_api_id=`);
  placeCache = new Map((boot.places ?? []).filter((p) => p.place?.slug).map((p) => [p.place.slug!, p.place.api_id]));
  return placeCache;
}

/** Flatten Luma's ProseMirror description document to plain text. */
export function proseToText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === "text") return n.text ?? "";
  const inner = (n.content ?? []).map(proseToText).join("");
  return n.type === "paragraph" || n.type === "heading" || n.type === "list_item" ? `${inner}\n` : inner;
}

/**
 * Registration deadline as stated by Luma: the latest end of sale across visible
 * ticket types, but only if EVERY visible type states one. Otherwise unknown.
 */
export function lumaDeadline(detail: LumaDetail | null): Date | null {
  const types = (detail?.ticket_types ?? []).filter((t) => !t.is_hidden && !t.is_disabled);
  if (types.length === 0 || types.some((t) => !t.valid_end_at)) return null;
  const max = Math.max(...types.map((t) => new Date(t.valid_end_at!).getTime()));
  return Number.isFinite(max) ? new Date(max) : null;
}

function priceText(e: LumaEntry): string | null {
  const ti = e.ticket_info;
  if (!ti) return null;
  if (ti.is_free) return "Free";
  if (ti.price?.cents != null) return `${ti.price.currency?.toUpperCase() ?? ""} ${(ti.price.cents / 100).toFixed(0)}`.trim();
  return null;
}

export const luma: Connector = {
  name: "Luma",
  method: "Public Discover listing JSON (luma.com/discover), plus public event detail",
  async fetch({ cities, windowStart, windowEnd }) {
    const errors: string[] = [];
    const entries: LumaEntry[] = [];
    let places: Map<string, string>;
    try {
      places = await placeIds();
    } catch (e) {
      return { candidates: [], errors: [`discover places: ${errMsg(e)}`] };
    }
    for (const city of cities) {
      const placeId = places.get(city.luma);
      if (!placeId) {
        errors.push(`${city.name}: not a Luma Discover city`);
        continue;
      }
      let cursor: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        try {
          const qs = new URLSearchParams({ discover_place_api_id: placeId, pagination_limit: String(PAGE_SIZE) });
          if (cursor) qs.set("pagination_cursor", cursor);
          const res = await fetchJson<{ entries?: LumaEntry[]; has_more?: boolean; next_cursor?: string }>(
            `${API}/discover/get-paginated-events?${qs}`,
          );
          const batch = res.entries ?? [];
          entries.push(...batch);
          const last = batch.at(-1)?.event.start_at;
          if (!res.has_more || !res.next_cursor || (last && new Date(last) > windowEnd)) break;
          cursor = res.next_cursor;
        } catch (e) {
          errors.push(`${city.name} page ${page + 1}: ${errMsg(e)}`);
          break;
        }
      }
    }

    const inWindow = entries.filter((e) => {
      if (!e.event?.start_at || !e.event.name || !e.event.url || e.event.visibility === "private") return false;
      const s = new Date(e.event.start_at);
      return s >= windowStart && s <= windowEnd;
    });
    const unique = [...new Map(inWindow.map((e) => [e.event.api_id, e])).values()];

    // Detail adds the description (needed for AI) and ticket end of sale (the real deadline).
    const details = await mapLimit(unique.slice(0, MAX_DETAIL_FETCHES), 4, async (e) => {
      try {
        return await fetchJson<LumaDetail>(`${API}/event/get?event_api_id=${encodeURIComponent(e.event.api_id)}`);
      } catch (err) {
        errors.push(`detail ${e.event.api_id}: ${errMsg(err)}`);
        return null;
      }
    });

    const candidates: CandidateEventInput[] = unique.map((e, i) => {
      const ev = e.event;
      const detail = details[i] ?? null;
      const url = `https://lu.ma/${ev.url}`;
      const cal = e.calendar?.name && e.calendar.name !== "Personal" ? e.calendar.name : null;
      const hosts = (e.hosts ?? []).map((h) => h.name).filter(Boolean).slice(0, 3).join(", ");
      const description = detail ? proseToText(detail.description_mirror).trim() : "";
      return {
        sourceName: "Luma",
        sourceEventId: ev.api_id,
        sourceUrl: url,
        title: ev.name!,
        description: description || null,
        startAt: new Date(ev.start_at!),
        endAt: ev.end_at ? new Date(ev.end_at) : null,
        allDay: false,
        timezone: ev.timezone ?? null,
        venue: ev.geo_address_info?.address ?? null,
        city: canonicalCity(ev.geo_address_info?.city),
        country: ev.geo_address_info?.country_code?.toUpperCase() ?? null,
        format: ev.location_type === "online" ? "online" : ev.location_type === "offline" ? "in_person" : "unknown",
        organiser: cal ?? (hosts || null),
        eventUrl: url,
        registrationUrl: url,
        statedDeadline: lumaDeadline(detail),
        registrationOpen:
          e.registration_availability === "open" && !e.ticket_info?.is_sold_out
            ? true
            : e.registration_availability
              ? false
              : null,
        priceText: priceText(e),
        imageUrl: ev.cover_url && /^https:\/\//.test(ev.cover_url) ? ev.cover_url : null,
      };
    });
    return { candidates, errors };
  },
};
