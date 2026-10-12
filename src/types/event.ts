import { z } from "zod";

export const EVENT_FORMATS = ["in_person", "online", "hybrid", "unknown"] as const;
export type EventFormat = (typeof EVENT_FORMATS)[number];

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "must be http(s)");

const optText = (max: number) =>
  z
    .string()
    .trim()
    .transform((s) => (s.length === 0 ? null : s.slice(0, max)))
    .nullish()
    .transform((v) => v ?? null);

/**
 * What a connector hands to the pipeline. Validated before anything is stored.
 * Unknown values are null, never guessed.
 */
export const CandidateEventSchema = z
  .object({
    sourceName: z.string().min(1),
    sourceEventId: z.string().min(1).max(300),
    sourceUrl: httpUrl,
    title: z.string().trim().min(3).max(300),
    description: optText(8000),
    startAt: z.date(),
    endAt: z.date().nullable().default(null),
    allDay: z.boolean().default(false),
    timezone: optText(64),
    venue: optText(300),
    city: optText(100),
    country: optText(60),
    format: z.enum(EVENT_FORMATS).default("unknown"),
    organiser: optText(200),
    eventUrl: httpUrl,
    registrationUrl: httpUrl.nullable().default(null),
    statedDeadline: z.date().nullable().default(null),
    registrationOpen: z.boolean().nullable().default(null),
    priceText: optText(80),
    imageUrl: z
      .string()
      .trim()
      .url()
      .refine((u) => /^https:\/\//i.test(u), "image must be https")
      .nullish()
      .catch(null)
      .transform((v) => v ?? null),
  })
  .refine((e) => !e.endAt || e.endAt >= e.startAt, { message: "endAt before startAt", path: ["endAt"] });

export type CandidateEvent = z.output<typeof CandidateEventSchema>;
export type CandidateEventInput = z.input<typeof CandidateEventSchema>;
