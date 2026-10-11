/**
 * Maps a user-facing city name to the identifiers each source uses for it.
 * Cities not listed here still work: identifiers are derived from the name, and a
 * connector that cannot resolve a city reports that in its run errors.
 */
export interface CityRef {
  name: string;
  aliases: string[];
  countryCode: string;
  eventbrite: string; // path segment, e.g. india--bengaluru
  meetup: string; // location param, e.g. in--Bengaluru
  luma: string; // discover place slug
}

const KNOWN: CityRef[] = [
  { name: "Bengaluru", aliases: ["bangalore", "bengaluru", "bengluru"], countryCode: "IN", eventbrite: "india--bengaluru", meetup: "in--Bengaluru", luma: "bengaluru" },
  { name: "Mumbai", aliases: ["mumbai", "bombay", "navi mumbai"], countryCode: "IN", eventbrite: "india--mumbai", meetup: "in--Mumbai", luma: "mumbai" },
  { name: "New Delhi", aliases: ["new delhi", "delhi", "gurugram", "gurgaon", "noida"], countryCode: "IN", eventbrite: "india--new-delhi", meetup: "in--New Delhi", luma: "new-delhi" },
  { name: "Hyderabad", aliases: ["hyderabad", "secunderabad"], countryCode: "IN", eventbrite: "india--hyderabad", meetup: "in--Hyderabad", luma: "hyderabad" },
  { name: "Pune", aliases: ["pune"], countryCode: "IN", eventbrite: "india--pune", meetup: "in--Pune", luma: "pune" },
  { name: "Chennai", aliases: ["chennai", "madras"], countryCode: "IN", eventbrite: "india--chennai", meetup: "in--Chennai", luma: "chennai" },
  { name: "Singapore", aliases: ["singapore"], countryCode: "SG", eventbrite: "singapore--singapore", meetup: "sg--Singapore", luma: "singapore" },
  { name: "Dubai", aliases: ["dubai"], countryCode: "AE", eventbrite: "united-arab-emirates--dubai", meetup: "ae--Dubai", luma: "dubai" },
];

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function resolveCity(name: string): CityRef {
  const key = name.trim().toLowerCase();
  const hit = KNOWN.find((c) => c.aliases.includes(key) || c.name.toLowerCase() === key);
  if (hit) return hit;
  const s = slug(name);
  return { name: name.trim(), aliases: [key], countryCode: "IN", eventbrite: `india--${s}`, meetup: `in--${name.trim()}`, luma: s };
}

/** Canonical city name for a raw locality string, or the trimmed input if unknown. */
export function canonicalCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  const hit = KNOWN.find((c) => c.aliases.includes(key));
  return hit ? hit.name : raw.trim();
}

export function cityMatches(eventCity: string | null, targets: string[]): boolean {
  if (!eventCity) return false;
  const c = canonicalCity(eventCity)?.toLowerCase();
  return targets.some((t) => resolveCity(t).name.toLowerCase() === c);
}
