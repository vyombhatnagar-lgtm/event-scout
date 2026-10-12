# Event Scout

**AI-powered event intelligence for business development.**
*Find the right rooms. Never miss the opportunity.*

Final examination project — MESA School of Business, Cohort C4, *AI and its Applications*. Problem statement: **Industry Event Scout**.

Vikram, an independent management consultant, wins 40% of new business at in-person events but loses ~45 minutes every Monday searching fragmented listings — and still misses deadlines. Event Scout pulls live events from several sources, ranks them for him with Gemini Flash, flags registration deadlines under 7 days, and emails a scannable briefing every Monday at 06:30 IST — before his week starts.

- **Architecture and requirement traceability:** [docs/COMPONENTS_MAP.md](docs/COMPONENTS_MAP.md)
- **Live app:** https://event-scout-five.vercel.app (open access for review; no sign-in needed)
- **Repository:** https://github.com/vyombhatnagar-lgtm/event-scout

## What it does

| | |
|---|---|
| Live discovery | Luma, Eventbrite and Meetup for your target cities, next 30 days; validated, normalised, de-duplicated, every source link kept |
| AI (Gemini Flash only) | Classification, 2-sentence summaries, explicit-deadline extraction with verbatim evidence, and relevance scoring blended with deterministic rules |
| Deadlines | Stated deadlines only (never inferred from the event date); `< 7 days` flagged urgent; "Deadline unknown" otherwise |
| Preferences | Categories, cities, topics, formats, minimum score, digest recipient, Calendly link — stored in the database, editable in the app |
| Dashboard | Weekly figures, top matches, urgent deadlines, actions, pipeline, source freshness |
| Pipeline & checklist | Saved → To register → Registered → Attended → Follow-up; weekly tasks derived from real events |
| Monday digest | Vercel Cron → HTML + text email via Resend, once per week (idempotent), with an 08:00 retry |
| Status | Source health, job history, configuration check |

## Stack

Next.js 16 (App Router, TypeScript, Cache Components) · Tailwind CSS 4 · Neon Postgres + Drizzle ORM · Gemini Flash via `@google/genai` (3.8 Flash, falling back to 3.6 / 3.5 Flash when a model is out of quota) · Resend · Calendly booking link · Vercel (hosting + cron) · Zod · Vitest.

Why each dependency: `@neondatabase/serverless` + `drizzle-orm` (serverless Postgres over HTTP, typed queries, versioned migrations), `@google/genai` (official Gemini SDK), `resend` (email with idempotency keys), `zod` (validation of all external data, AI output and API input), `server-only` (keeps keys out of client bundles), `vitest`/`drizzle-kit`/`dotenv`/`tsx` (dev only).

## Run it locally

Requirements: Node 20+ (tested on Node 24), npm.

```bash
npm install
```

1. Copy [.env.example](.env.example) to `.env.local` and fill in `DATABASE_URL` (Neon), `GEMINI_API_KEY`, `RESEND_API_KEY`, `DIGEST_RECIPIENT_EMAIL`, `CRON_SECRET`. `APP_PASSWORD` is optional (leave empty for open access).
2. Create the tables (also runs automatically before every build):

```bash
npm run db:migrate
```

3. Start the app and open http://localhost:3000:

```bash
npm run dev
```

4. Sign in, then **Run discovery now** on the dashboard. The first run fetches live events and scores them (1–3 minutes).

## Tests

```bash
npm test
```

```bash
npm run test:live
```

`npm test` covers deadline boundaries (exactly 7 days, 7 days − 1 s, tomorrow, passed, unknown, conflicting sources), IST time handling, normalisation, de-duplication, ranking rules, preference effects, and the AI evidence guard. `npm run test:live` hits the real sources.

## Deploy to Vercel

1. Import the GitHub repo in Vercel.
2. Storage → Create Database → Neon (prefix `DATABASE`) — this sets `DATABASE_URL` automatically.
3. Add `GEMINI_API_KEY`, `RESEND_API_KEY`, `DIGEST_RECIPIENT_EMAIL`, `CRON_SECRET` (optional: `APP_PASSWORD`, `SESSION_SECRET`, `CALENDLY_URL`, `GEMINI_MODEL`) in Settings → Environment Variables.
4. Deploy. Migrations run before the build. `vercel.json` registers the crons: discovery daily 05:00 IST, digest Mondays 06:30 IST (+08:00 retry). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

The production deployment is set up exactly this way.

## Project layout

```
src/
  app/(app)/        dashboard, events, events/[id], pipeline, checklist, digest, settings, status
  app/api/          cron/discover, cron/digest, jobs, preferences, events/[id]/status, checklist/[id], digest/preview, auth/login
  app/login/        sign-in
  proxy.ts          password protection for every page and API route
  components/       dashboard UI, event cards, checklist, settings form, shared UI
  lib/discovery/    connectors (luma, eventbrite, meetup), normalise, deduplicate, pipeline
  lib/ai/           gemini client, classification, deadlines + evidence guard, ranking, batch processing
  lib/ranking/      deterministic scoring rules
  lib/digest/       selection + send with idempotency
  lib/email/        Resend wrapper, HTML/text template
  lib/services/     users/preferences, events queries, checklist, jobs, workflows
  lib/deadlines.ts  urgency policy;  lib/time.ts  IST time policy
db/migrations/      SQL migrations (Drizzle)
tests/              unit tests; tests/live for live-source acceptance tests
docs/               Components Map
```

## Known limitations

See [Components Map §8](docs/COMPONENTS_MAP.md#8-known-limitations). In short: three sources (not universal coverage); most listings publish no registration deadline; Luma's endpoint is undocumented and listing-page data can change; Google Calendar is planned (Phase 7).
