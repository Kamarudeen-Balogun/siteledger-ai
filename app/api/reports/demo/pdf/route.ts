import { getDemoReport } from "@/lib/reports/data";
import { pdfResponse, pdfError } from "@/lib/pdf/export";
export async function GET() {
  try { return await pdfResponse(await getDemoReport()); } catch (error) { return pdfError(error); }
}
