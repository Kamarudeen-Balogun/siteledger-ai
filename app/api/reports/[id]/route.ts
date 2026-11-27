import { createReport } from "@/lib/reports/data";
import { isAllowedAppOrigin } from "@/lib/app-url";
import { ReportStateError } from "@/lib/reports/model";
import { requestSessionHash } from "@/lib/auth/session";
import { smallJson } from "@/lib/auth/request";
import { AccountError } from "@/lib/auth/provider";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAllowedAppOrigin(request.headers.get("origin")))
    return Response.json({ error: "Open your private report link." }, { status: 403, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 2000)
    return Response.json({ error: "The weather note is too long." }, { status: 413, headers });
  try {
    const input: unknown = await smallJson(request,2000);
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => key !== "weather")
      || ("weather" in input && input.weather !== null && (typeof input.weather !== "string" || input.weather.length > 500)))
      return Response.json({ error: "Send only the weather note." }, { status: 422, headers });
    const { id } = await context.params;
    const result = await createReport(id, requestSessionHash(request), "weather" in input ? typeof input.weather === "string" ? input.weather.trim() || null : null : undefined);
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ReportStateError || error instanceof AccountError ? error.message : "Could not create the report. Your confirmed note is saved; try again." },
      { status: error instanceof ReportStateError || error instanceof AccountError ? error.status : 503, headers });
  }
}
