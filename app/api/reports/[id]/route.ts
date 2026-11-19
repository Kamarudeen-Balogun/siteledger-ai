import { createReport } from "@/lib/reports/data";
import { ReportStateError } from "@/lib/reports/model";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (request.headers.get("origin") !== process.env.SITELEDGER_APP_URL)
    return Response.json({ error: "Open your private report link." }, { status: 403, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 2000)
    return Response.json({ error: "The weather note is too long." }, { status: 413, headers });
  try {
    const text = await request.text();
    if (text.length > 2000) return Response.json({ error: "The weather note is too long." }, { status: 413, headers });
    let input: unknown;
    try { input = JSON.parse(text); } catch { return Response.json({ error: "Check the weather note." }, { status: 422, headers }); }
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => key !== "weather")
      || ("weather" in input && input.weather !== null && (typeof input.weather !== "string" || input.weather.length > 500)))
      return Response.json({ error: "Send only the weather note." }, { status: 422, headers });
    const { id } = await context.params;
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const result = await createReport(id, token, "weather" in input ? typeof input.weather === "string" ? input.weather.trim() || null : null : undefined);
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ReportStateError ? error.message : "Could not create the report. Your confirmed note is saved; try again." },
      { status: error instanceof ReportStateError ? error.status : 503, headers });
  }
}
