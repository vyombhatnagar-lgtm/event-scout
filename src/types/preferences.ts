import { z } from "zod";
import { EVENT_FORMATS } from "./event";

const list = (max: number) =>
  z
    .array(z.string().trim().min(1).max(60))
    .max(max)
    .transform((xs) => [...new Set(xs.map((x) => x.trim()))]);

export const PreferencesSchema = z.object({
  categories: list(20).pipe(z.array(z.string()).min(1, "Pick at least one category")),
  cities: list(10).pipe(z.array(z.string()).min(1, "Pick at least one city")),
  topics: list(30),
  formats: z.array(z.enum(EVENT_FORMATS)).min(1, "Pick at least one format"),
  minScore: z.coerce.number().int().min(0).max(100),
  digestEmail: z
    .string()
    .trim()
    .email()
    .or(z.literal(""))
    .transform((v) => v || null)
    .nullable(),
  digestEnabled: z.boolean(),
  calendlyUrl: z
    .string()
    .trim()
    .url()
    .refine((u) => /^https:\/\/(www\.)?calendly\.com\//i.test(u), "Must be a calendly.com link")
    .or(z.literal(""))
    .transform((v) => v || null)
    .nullable(),
});

export type Preferences = z.output<typeof PreferencesSchema>;

/** Starting configuration for Vikram. Shown as "default" in the UI until he saves his own. */
export const DEFAULT_PREFERENCES: Preferences = {
  categories: ["Conferences", "CXO summits", "Roundtables", "Startup ecosystem meetups", "Industry forums"],
  cities: ["Bengaluru", "Mumbai", "New Delhi"],
  topics: [
    "Business strategy",
    "Operations",
    "Digital transformation",
    "Leadership",
    "Startups",
    "Venture capital",
    "Financial services",
    "Artificial intelligence",
  ],
  formats: ["in_person", "hybrid"],
  minScore: 50,
  digestEmail: null,
  digestEnabled: true,
  calendlyUrl: null,
};

export const CATEGORY_OPTIONS = [
  "Conferences",
  "CXO summits",
  "Roundtables",
  "Startup ecosystem meetups",
  "Industry forums",
  "Workshops",
  "Networking mixers",
  "Webinars",
  "Investor events",
];

export const CITY_OPTIONS = ["Bengaluru", "Mumbai", "New Delhi", "Hyderabad", "Pune", "Chennai", "Singapore", "Dubai"];

export const FORMAT_LABELS: Record<(typeof EVENT_FORMATS)[number], string> = {
  in_person: "In person",
  hybrid: "Hybrid",
  online: "Online",
  unknown: "Format not stated",
};
