import { readEvidence } from "@/lib/confirm/data";
import { readSharedReport } from "@/lib/reports/sharing";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; photo: string }> }) {
  const { id, photo } = await params;
  if (!/^[1-5]$/.test(photo)) return new Response(null, { status: 404, headers });
  try {
    const report = await readSharedReport(id);
    const evidence = report?.document.source.photos[Number(photo) - 1];
    if (!evidence) return new Response(null, { status: 404, headers });
    const data = await readEvidence(evidence.storage_url, false);
    return new Response(data.bytes, { headers: { ...headers, "Content-Type": "image/jpeg" } });
  } catch { return new Response(null, { status: 503, headers }); }
}
