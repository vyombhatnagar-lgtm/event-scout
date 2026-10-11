import { connection } from "next/server";
import { apiError } from "@/lib/api";
import { buildDigest } from "@/lib/digest/service";
import { renderDigestHtml, renderDigestText } from "@/lib/email/templates/digest";

/** Renders exactly what the next digest email would contain, without sending it. */
export async function GET(req: Request) {
  await connection();
  try {
    const { content } = await buildDigest();
    const asText = new URL(req.url).searchParams.get("format") === "text";
    return new Response(asText ? renderDigestText(content) : renderDigestHtml(content), {
      headers: { "content-type": asText ? "text/plain; charset=utf-8" : "text/html; charset=utf-8" },
    });
  } catch (e) {
    return apiError(e, "digest/preview");
  }
}
