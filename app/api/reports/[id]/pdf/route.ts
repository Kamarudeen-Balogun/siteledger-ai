import { getReport } from "@/lib/reports/data";
import { pdfResponse, pdfError } from "@/lib/pdf/export";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return await pdfResponse(await getReport(id, new URL(request.url).searchParams.get("access") ?? ""));
  } catch (error) { return pdfError(error); }
}
