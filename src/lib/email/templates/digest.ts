import type { DigestContent } from "@/lib/digest/build";
import type { EventView } from "@/lib/services/events";
import { formatDate, formatEventWhen } from "@/lib/time";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const place = (e: EventView) => (e.format === "online" ? "Online" : [e.city, e.format === "hybrid" ? "Hybrid" : null].filter(Boolean).join(" · ") || "Location not stated");
const deadlineText = (e: EventView) => {
  if (!e.deadline) return "Deadline unknown";
  const d = formatDate(e.deadline, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${d} IST${e.deadlineOrigin === "ai_extracted" ? " (from event text)" : ""}${e.deadlineConflict ? " — sources disagree, earliest shown" : ""}`;
};

export function digestSubject(c: DigestContent) {
  const u = c.urgent.length;
  return `Event Scout · ${c.totalRelevant} relevant event${c.totalRelevant === 1 ? "" : "s"}${u ? ` · ${u} deadline${u === 1 ? "" : "s"} this week` : ""} — w/c ${formatDate(new Date(`${c.weekStart}T12:00:00Z`), { day: "numeric", month: "short" })}`;
}

function eventLinks(e: EventView) {
  const reg = e.registrationUrl ? `<a href="${esc(e.registrationUrl)}" style="color:#1F4E79;font-weight:600">Register</a>` : "";
  const src = e.sources.map((s) => `<a href="${esc(s.url)}" style="color:#59606B">${esc(s.name)}</a>`).join(" · ");
  return [reg, src ? `Source: ${src}` : ""].filter(Boolean).join(" &nbsp;·&nbsp; ");
}

export function renderDigestHtml(c: DigestContent): string {
  const urgent = c.urgent
    .map(
      (e) => `<tr><td style="padding:12px 14px;border:1px solid #F0D5C0;background:#FFFAF6;border-radius:6px">
<div style="font:600 12px Arial,sans-serif;color:#9A3C07;letter-spacing:.04em">${esc(e.deadlineState.label.toUpperCase())}</div>
<div style="font:600 15px Arial,sans-serif;color:#111418;margin:4px 0">${esc(e.title)}</div>
<div style="font:13px Arial,sans-serif;color:#3D434B">${esc(formatEventWhen(e.startAt, e.allDay))} · ${esc(place(e))}${e.score != null ? ` · Fit ${e.score}` : ""}</div>
<div style="font:13px Arial,sans-serif;color:#3D434B;margin-top:4px">Registration closes: ${esc(deadlineText(e))}</div>
<div style="font:13px Arial,sans-serif;margin-top:6px">${eventLinks(e)}</div>
</td></tr><tr><td style="height:10px"></td></tr>`,
    )
    .join("");

  const ranked = c.ranked
    .map(
      (e) => `<tr><td style="padding:14px 0;border-bottom:1px solid #EEEFEB">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="48" valign="top"><div style="width:40px;height:40px;line-height:40px;border-radius:20px;background:#E8EEF4;color:#1F4E79;text-align:center;font:600 14px Arial,sans-serif">${e.score ?? "–"}</div></td>
<td valign="top">
<div style="font:12px Arial,sans-serif;color:#59606B">${esc([e.categories[0], formatEventWhen(e.startAt, e.allDay), place(e)].filter(Boolean).join(" · "))}</div>
<div style="font:600 15px Arial,sans-serif;color:#111418;margin:3px 0">${esc(e.title)}</div>
${e.reason ? `<div style="font:14px Arial,sans-serif;color:#3D434B;line-height:1.45">${esc(e.reason)}</div>` : ""}
<div style="font:13px Arial,sans-serif;color:#59606B;margin-top:5px">Deadline: ${esc(deadlineText(e))}</div>
<div style="font:13px Arial,sans-serif;margin-top:4px">${eventLinks(e)}</div>
</td></tr></table></td></tr>`,
    )
    .join("");

  const tasks = c.tasks.map((t) => `<li style="margin:0 0 6px">${esc(t.label)}${t.detail ? ` <span style="color:#59606B">— ${esc(t.detail)}</span>` : ""}</li>`).join("");

  return `<!doctype html><html><body style="margin:0;background:#ECEDE9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECEDE9"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#FFFFFF;border-radius:6px">
<tr><td style="background:#111418;padding:24px 28px;border-radius:6px 6px 0 0">
<div style="font:12px Arial,sans-serif;color:#A9AFA6;letter-spacing:.06em">EVENT SCOUT · WEEK OF ${esc(formatDate(new Date(`${c.weekStart}T12:00:00Z`), { day: "numeric", month: "short", year: "numeric" }).toUpperCase())}</div>
<div style="font:600 22px Arial,sans-serif;color:#FFFFFF;margin-top:6px">Your rooms worth entering</div>
<div style="font:14px Arial,sans-serif;color:#C9CDC5;margin-top:4px">${c.totalRelevant} relevant event${c.totalRelevant === 1 ? "" : "s"} in the next 30 days · ${c.urgent.length} registration deadline${c.urgent.length === 1 ? "" : "s"} within 7 days</div>
</td></tr>
${c.urgent.length ? `<tr><td style="padding:22px 28px 4px"><div style="font:700 12px Arial,sans-serif;color:#9A3C07;letter-spacing:.08em;margin-bottom:10px">ACT THIS WEEK — DEADLINES UNDER 7 DAYS</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${urgent}</table></td></tr>` : ""}
<tr><td style="padding:18px 28px 4px"><div style="font:700 12px Arial,sans-serif;color:#59606B;letter-spacing:.08em">TOP RANKED · NEXT 30 DAYS</div>
${c.ranked.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${ranked}</table>` : `<p style="font:14px Arial,sans-serif;color:#3D434B">No events met your minimum relevance score this week. You can lower it in Preferences.</p>`}
</td></tr>
${tasks ? `<tr><td style="padding:18px 28px"><div style="background:#F4F5F2;border-radius:6px;padding:16px 18px"><div style="font:700 12px Arial,sans-serif;color:#59606B;letter-spacing:.08em;margin-bottom:8px">YOUR CHECKLIST</div><ul style="font:14px Arial,sans-serif;color:#111418;margin:0;padding-left:18px">${tasks}</ul></div></td></tr>` : ""}
<tr><td style="padding:6px 28px 28px">
<a href="${esc(c.dashboardUrl)}" style="display:inline-block;background:#1F4E79;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:6px;font:600 14px Arial,sans-serif">Open your dashboard</a>
${c.calendlyUrl ? `<a href="${esc(c.calendlyUrl)}" style="display:inline-block;margin-left:10px;color:#1F4E79;font:600 14px Arial,sans-serif">Your booking link</a>` : ""}
<p style="font:12px Arial,sans-serif;color:#59606B;line-height:1.6;margin:18px 0 0">${esc(c.prefsNote)} ${esc(c.sourceNote)} Deadlines are shown only when a source or the event text states one.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function renderDigestText(c: DigestContent): string {
  const line = (e: EventView) =>
    [
      `• ${e.title}${e.score != null ? ` (fit ${e.score})` : ""}`,
      `  ${formatEventWhen(e.startAt, e.allDay)} · ${place(e)}`,
      e.reason ? `  Why: ${e.reason}` : null,
      `  Deadline: ${deadlineText(e)}`,
      e.registrationUrl ? `  Register: ${e.registrationUrl}` : null,
      ...e.sources.map((s) => `  Source (${s.name}): ${s.url}`),
    ]
      .filter(Boolean)
      .join("\n");
  return [
    `EVENT SCOUT — week of ${c.weekStart}`,
    `${c.totalRelevant} relevant events in the next 30 days · ${c.urgent.length} deadlines within 7 days`,
    "",
    c.urgent.length ? "ACT THIS WEEK — DEADLINES UNDER 7 DAYS" : null,
    ...c.urgent.map(line),
    "",
    "TOP RANKED · NEXT 30 DAYS",
    ...(c.ranked.length ? c.ranked.map(line) : ["No events met your minimum relevance score this week."]),
    "",
    c.tasks.length ? "YOUR CHECKLIST" : null,
    ...c.tasks.map((t) => `[ ] ${t.label}${t.detail ? ` — ${t.detail}` : ""}`),
    "",
    `Dashboard: ${c.dashboardUrl}`,
    c.calendlyUrl ? `Booking link: ${c.calendlyUrl}` : null,
    `${c.prefsNote} ${c.sourceNote}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
