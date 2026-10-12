import type { EventFormat } from "@/types/event";

/** A schema.org Event as published in a page's <script type="application/ld+json">. */
export interface LdEvent {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  eventAttendanceMode?: string;
  eventStatus?: string;
  location?: LdPlace | LdPlace[];
  organizer?: { name?: string } | { name?: string }[];
  offers?: LdOffer | LdOffer[];
}

interface LdOffer {
  price?: string | number;
  priceCurrency?: string;
  url?: string;
  availabilityEnds?: string;
  availability?: string;
}

interface LdPlace {
  "@type"?: string;
  name?: string;
  url?: string;
  address?: string | { addressLocality?: string; addressCountry?: string; streetAddress?: string };
}

const isEventType = (t: unknown) => {
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && /Event$/.test(x));
};

/** Extract every schema.org Event from an HTML page (handles arrays, @graph and ItemList). */
export function extractLdEvents(html: string): LdEvent[] {
  const out: LdEvent[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const n = node as Record<string, unknown>;
    if (isEventType(n["@type"])) out.push(n as LdEvent);
    if (Array.isArray(n["@graph"])) visit(n["@graph"]);
    if (Array.isArray(n.itemListElement)) {
      for (const li of n.itemListElement as Record<string, unknown>[]) visit(li?.item ?? li);
    }
  };
  for (const m of html.matchAll(re)) {
    try {
      visit(JSON.parse(m[1]));
    } catch {
      // one malformed block must not hide the others
    }
  }
  return out;
}

export function ldFormat(mode: string | undefined): EventFormat {
  if (!mode) return "unknown";
  if (/Mixed/i.test(mode)) return "hybrid";
  if (/Online/i.test(mode)) return "online";
  if (/Offline/i.test(mode)) return "in_person";
  return "unknown";
}

export function ldPlace(ev: LdEvent) {
  const loc = Array.isArray(ev.location) ? ev.location.find((l) => l["@type"] === "Place") ?? ev.location[0] : ev.location;
  if (!loc) return { venue: null, city: null, country: null };
  const addr = typeof loc.address === "object" ? loc.address : undefined;
  return {
    venue: loc.name ?? (typeof loc.address === "string" ? loc.address : addr?.streetAddress) ?? null,
    city: addr?.addressLocality || null,
    country: addr?.addressCountry ? String(addr.addressCountry).toUpperCase() : null,
  };
}

export function ldOrganiser(ev: LdEvent): string | null {
  const o = Array.isArray(ev.organizer) ? ev.organizer[0] : ev.organizer;
  return o?.name?.trim() || null;
}

export function ldPrice(ev: LdEvent): string | null {
  const o = Array.isArray(ev.offers) ? ev.offers[0] : ev.offers;
  if (!o || o.price === undefined || o.price === null || o.price === "") return null;
  const p = Number(o.price);
  if (p === 0) return "Free";
  return `${o.priceCurrency ?? ""} ${o.price}`.trim();
}

export function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

/** "2026-10-23" (date only) vs a full ISO timestamp. */
export const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
