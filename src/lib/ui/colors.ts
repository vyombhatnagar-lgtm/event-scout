/**
 * Category colour families. Each event gets a hue from its main category so the app
 * reads at a glance: tint = card/cover background, shape = decorative + dots, ink = text on tint.
 */
export interface Hue {
  name: string;
  tint: string;
  shape: string;
  ink: string;
}

const HUES: Record<string, Hue> = {
  green: { name: "green", tint: "#E4EEE6", shape: "#B5D4BF", ink: "#1F5F4A" },
  amber: { name: "amber", tint: "#F6EBDA", shape: "#EBC995", ink: "#7A4E0F" },
  blue: { name: "blue", tint: "#E3E9F5", shape: "#B4C4E6", ink: "#2A4A8A" },
  violet: { name: "violet", tint: "#ECE6F6", shape: "#CDBBEA", ink: "#5B3E96" },
  rose: { name: "rose", tint: "#F6E4E6", shape: "#E7B5BD", ink: "#8E2F45" },
  teal: { name: "teal", tint: "#DFF0EE", shape: "#A6D5CF", ink: "#1D6B66" },
  peach: { name: "peach", tint: "#FBE7DD", shape: "#F1BFA4", ink: "#8A3B16" },
  slate: { name: "slate", tint: "#E7EAEE", shape: "#C1C8D2", ink: "#3C4656" },
};

const BY_CATEGORY: Record<string, keyof typeof HUES> = {
  Conference: "blue",
  "CXO summit": "violet",
  Roundtable: "green",
  "Startup ecosystem meetup": "amber",
  "Industry forum": "teal",
  Workshop: "rose",
  "Networking mixer": "peach",
  "Investor event": "rose",
  Webinar: "slate",
  Hackathon: "violet",
  "Training / certification": "slate",
  "Social / community": "peach",
};

const ORDER = Object.keys(HUES) as (keyof typeof HUES)[];

/** Hue for an event: from its first category, else a stable pick from its title. */
export function hueFor(categories: string[], seed: string): Hue {
  const fromCat = categories.map((c) => BY_CATEGORY[c]).find(Boolean);
  if (fromCat) return HUES[fromCat];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[ORDER[h % ORDER.length]];
}

/** Short, friendly label for a category chip. */
export function categoryLabel(categories: string[]): string {
  const c = categories[0];
  if (!c) return "Event";
  return c === "Startup ecosystem meetup" ? "Startup meetup" : c;
}
