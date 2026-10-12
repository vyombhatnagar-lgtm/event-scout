import type { DigestContent } from "@/lib/digest/build";
import type { EventView } from "@/lib/services/events";
import { formatDate, formatEventWhen } from "@/lib/time";

/**
 * Monday briefing, an executive memo layout: serif headlines, numbered sections, thin rules.
 * Table based markup and inline styles so it renders in Gmail, Outlook and Apple Mail.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif";
const SANS = "'Instrument Sans',-apple-system,'Segoe UI',Arial,sans-serif";
const NAVY = "#14284B";
const ORANGE = "#B4410C";

const place = (e: EventView) => (e.format === "online" ? "Online" : [e.city, e.format === "hybrid" ? "Hybrid" : null].filter(Boolean).join(" · ") || "Location not stated");
const deadlineText = (e: EventView) => {
  if (!e.deadline) return "Deadline not stated";
  const d = formatDate(e.deadline, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  return `Closes ${d} IST${e.deadlineOrigin === "ai_extracted" ? " (from event text)" : ""}${e.deadlineConflict ? ", sources disagree, earliest shown" : ""}`;
};
const leftLabel = (e: EventView) => {
  const s = e.deadlineState;
  if (s.kind !== "urgent") return "";
  return s.msLeft < 86_400_000 ? "&lt;1 day" : `${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"}`;
};

export function digestSubject(c: DigestContent) {
  const u = c.urgent.length;
  const lead = u ? `${u} registration${u === 1 ? "" : "s"} close this week` : `${c.totalRelevant} rooms worth your time`;
  return `Your week in rooms · ${lead}, ${formatDate(new Date(`${c.weekStart}T12:00:00Z`), { day: "numeric", month: "short" })}`;
}

function links(e: EventView, c: DigestContent) {
  const parts = [
    e.registrationUrl && e.deadlineState.kind !== "closed" ? `<a href="${esc(e.registrationUrl)}" style="color:${NAVY};font-weight:600;text-decoration:underline">Register →</a>` : "",
    `<a href="${esc(`${c.appUrl}/api/events/${e.id}/ics`)}" style="color:#5A5F66;text-decoration:underline">Add to calendar</a>`,
    ...e.sources.slice(0, 2).map((s) => `<a href="${esc(s.url)}" style="color:#5A5F66;text-decoration:underline">${esc(s.name)}</a>`),
  ].filter(Boolean);
  return parts.join(` <span style="color:#B5B2AA">·</span> `);
}

function urgentRow(e: EventView, c: DigestContent) {
  return `<tr><td style="padding:16px 0;border-bottom:1px solid #ECEAE5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="72" valign="top" style="font-family:${SERIF};color:${ORANGE};font-size:24px;line-height:1">${leftLabel(e)}<div style="font-family:${SANS};font-size:11px;color:#8A8E95;margin-top:5px">to close</div></td>
<td valign="top">
<div style="font-family:${SERIF};font-size:21px;line-height:1.25;color:#0B1630">${esc(e.title)}</div>
<div style="font-family:${SANS};font-size:13px;color:#6B6F76;margin:5px 0 7px">${esc(formatEventWhen(e.startAt, e.allDay))} · ${esc(place(e))}${e.score != null ? ` · fit ${e.score}` : ""}</div>
${e.reason || e.summary ? `<div style="font-family:${SANS};font-size:14.5px;line-height:1.55;color:#3F434A">${esc((e.reason ?? e.summary)!)}</div>` : ""}
<div style="font-family:${SANS};font-size:13px;color:${ORANGE};margin-top:7px">${esc(deadlineText(e))}</div>
<div style="font-family:${SANS};font-size:13px;margin-top:8px">${links(e, c)}</div>
</td></tr></table></td></tr>`;
}

function rankedRow(e: EventView, c: DigestContent) {
  return `<tr><td style="padding:15px 0;border-bottom:1px solid #ECEAE5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="72" valign="top" style="font-family:${SERIF};font-size:24px;color:${NAVY};line-height:1">${e.score ?? " to "}<div style="font-family:${SANS};font-size:11px;color:#8A8E95;margin-top:5px">fit</div></td>
<td valign="top">
<div style="font-family:${SANS};font-size:15.5px;font-weight:600;color:#0B1630">${esc(e.title)}</div>
<div style="font-family:${SANS};font-size:13px;color:#6B6F76;margin:4px 0 6px">${esc(formatEventWhen(e.startAt, e.allDay))} · ${esc(place(e))} · ${esc(deadlineText(e))}</div>
${e.reason || e.summary ? `<div style="font-family:${SANS};font-size:14px;line-height:1.5;color:#3F434A">${esc((e.reason ?? e.summary)!)}</div>` : ""}
<div style="font-family:${SANS};font-size:13px;margin-top:7px">${links(e, c)}</div>
</td></tr></table></td></tr>`;
}

const label = (n: string, text: string, color = NAVY) =>
  `<div style="font-family:${SANS};font-size:11px;letter-spacing:.14em;font-weight:700;color:${color};margin:30px 0 4px">${n} · ${text}</div>`;

export function renderDigestHtml(c: DigestContent): string {
  const week = formatDate(new Date(`${c.weekStart}T12:00:00Z`), { weekday: "short", day: "numeric", month: "short", year: "numeric" }).toUpperCase();
  const headline = c.urgent.length
    ? `${c.urgent.length} registration${c.urgent.length === 1 ? "" : "s"} close before the week is out`
    : c.totalRelevant
      ? `${c.totalRelevant} rooms worth your time this month`
      : "A quiet week, nothing above your bar";
  const tasks = c.tasks.map((t) => `<li style="margin:0 0 6px">${esc(t.label)}${t.detail ? ` <span style="color:#8A8E95">,  ${esc(t.detail)}</span>` : ""}</li>`).join("");

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;600&family=Instrument+Serif&display=swap" rel="stylesheet"></head>
<body style="margin:0;background:#F3F2EE">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F2EE"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#FFFFFF;border-top:4px solid ${NAVY}">
<tr><td style="padding:34px 38px 30px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #1A1C20"><tr>
<td style="font-family:${SANS};font-size:11px;letter-spacing:.14em;font-weight:700;color:${NAVY};padding-bottom:10px">EVENT SCOUT · WEEKLY BRIEFING</td>
<td align="right" style="font-family:${SANS};font-size:11px;letter-spacing:.08em;color:#6B6F76;padding-bottom:10px">${esc(week)}</td></tr></table>
<h1 style="margin:22px 0 8px;font-family:${SERIF};font-weight:400;font-size:34px;line-height:1.15;color:#0B1630">${esc(headline)}</h1>
<p style="margin:0 0 20px;font-family:${SANS};font-size:15px;line-height:1.6;color:#3F434A">Good morning, Vikram. Here is everything relevant in your cities over the next 30 days, with the decisions that can&rsquo;t wait listed first.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #DAD8D2;border-bottom:1px solid #DAD8D2"><tr>
<td style="padding:12px 0;font-family:${SANS}"><div style="font-family:${SERIF};font-size:28px;color:#0B1630">${c.totalRelevant}</div><div style="font-size:12px;color:#6B6F76">relevant · 30 days</div></td>
<td style="padding:12px 0 12px 16px;border-left:1px solid #DAD8D2;font-family:${SANS}"><div style="font-family:${SERIF};font-size:28px;color:${ORANGE}">${c.urgent.length}</div><div style="font-size:12px;color:#6B6F76">closing within 7 days</div></td>
<td style="padding:12px 0 12px 16px;border-left:1px solid #DAD8D2;font-family:${SANS}"><div style="font-family:${SERIF};font-size:28px;color:#0B1630">${c.tasks.length}</div><div style="font-size:12px;color:#6B6F76">actions this week</div></td>
</tr></table>
${c.urgent.length ? `${label("01", "DECIDE THIS WEEK", ORANGE)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${c.urgent.map((e) => urgentRow(e, c)).join("")}</table>` : ""}
${label(c.urgent.length ? "02" : "01", "BEST MATCHES, NEXT 30 DAYS")}
${c.ranked.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${c.ranked.map((e) => rankedRow(e, c)).join("")}</table>` : `<p style="font-family:${SANS};font-size:14px;color:#3F434A">Nothing new met your minimum fit this week. You can lower it in Settings.</p>`}
${tasks ? `${label(c.urgent.length ? "03" : "02", "THIS WEEK")}<ol style="margin:8px 0 0;padding-left:20px;font-family:${SANS};font-size:14px;line-height:1.7;color:#1A1C20">${tasks}</ol>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:30px"><tr>
<td style="background:${NAVY}"><a href="${esc(c.dashboardUrl)}" style="display:inline-block;padding:13px 20px;font-family:${SANS};font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none">Open today&rsquo;s view</a></td>
${c.calendlyUrl ? `<td style="padding-left:16px"><a href="${esc(c.calendlyUrl)}" style="font-family:${SANS};font-size:14px;font-weight:600;color:${NAVY};text-decoration:underline">Your booking link</a></td>` : ""}
</tr></table>
<p style="margin:28px 0 0;padding-top:14px;border-top:1px solid #ECEAE5;font-family:${SANS};font-size:12px;line-height:1.6;color:#8A8E95">${esc(c.prefsNote)} ${esc(c.sourceNote)} Deadlines appear only when a source or the event text states one.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function renderDigestText(c: DigestContent): string {
  const line = (e: EventView) =>
    [
      `• ${e.title}${e.score != null ? ` (fit ${e.score})` : ""}`,
      `  ${formatEventWhen(e.startAt, e.allDay)} · ${place(e)}`,
      e.reason ? `  Why: ${e.reason}` : null,
      `  ${deadlineText(e)}`,
      e.registrationUrl ? `  Register: ${e.registrationUrl}` : null,
      `  Add to calendar: ${c.appUrl}/api/events/${e.id}/ics`,
      ...e.sources.map((s) => `  Source (${s.name}): ${s.url}`),
    ]
      .filter(Boolean)
      .join("\n");
  return [
    `EVENT SCOUT, WEEKLY BRIEFING · week of ${c.weekStart}`,
    `${c.totalRelevant} relevant events in the next 30 days · ${c.urgent.length} close within 7 days`,
    "",
    c.urgent.length ? "01 · DECIDE THIS WEEK" : null,
    ...c.urgent.map(line),
    "",
    "BEST MATCHES, NEXT 30 DAYS",
    ...(c.ranked.length ? c.ranked.map(line) : ["Nothing new met your minimum fit this week."]),
    "",
    c.tasks.length ? "THIS WEEK" : null,
    ...c.tasks.map((t) => `[ ] ${t.label}${t.detail ? `, ${t.detail}` : ""}`),
    "",
    `Open today's view: ${c.dashboardUrl}`,
    c.calendlyUrl ? `Booking link: ${c.calendlyUrl}` : null,
    `${c.prefsNote} ${c.sourceNote}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
