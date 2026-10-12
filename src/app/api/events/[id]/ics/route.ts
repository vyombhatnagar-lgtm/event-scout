import { connection } from "next/server";
import { apiError, badRequest } from "@/lib/api";
import { buildIcs } from "@/lib/calendar/ics";
import { toCalendarEvent } from "@/lib/calendar/from-event";
import { getEvent } from "@/lib/services/events";
import { getUser } from "@/lib/services/user";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Downloadable .ics for one event (+ a separate registration deadline reminder when known). */
export async function GET(_req: Request, ctx: RouteContext<"/api/events/[id]/ics">) {
  await connection();
  const { id } = await ctx.params;
  if (!UUID.test(id)) return badRequest("Invalid event id");
  try {
    const user = await getUser();
    const e = await getEvent(user.id, id);
    if (!e) return new Response("Event not found", { status: 404 });
    const slug = e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "event";
    return new Response(buildIcs(toCalendarEvent(e)), {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="${slug}.ics"`,
      },
    });
  } catch (err) {
    return apiError(err, "events/ics");
  }
}
