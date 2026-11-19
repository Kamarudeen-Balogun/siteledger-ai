import "server-only";
import { readEvidence } from "../confirm/data";
import { ReportStateError, type ReportView } from "../reports/model";
import { renderReportPdf } from "./report-template";

export async function pdfResponse(report: ReportView | null) {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
  if (!report) return Response.json({ error: "Report unavailable. Open your private report link." }, { status: 404, headers });
  if (report.stale) throw new ReportStateError("The confirmation or BoQ has changed. Rebuild the draft before exporting.");
  const photos = await Promise.all(report.document.source.photos.map(async photo => {
    const evidence = await readEvidence(photo.storage_url, false);
    return `data:image/jpeg;base64,${Buffer.from(evidence.bytes).toString("base64")}`;
  }));
  const bytes = await renderReportPdf(report, photos);
  return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="SiteLedger-${report.document.source.date}-${report.id.slice(0,8)}.pdf"` } });
}
export function pdfError(error: unknown) {
  return Response.json({ error: error instanceof ReportStateError ? error.message : "Could not prepare the PDF. Your report and photos are saved; try again." },
    { status: error instanceof ReportStateError ? error.status : 503, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
