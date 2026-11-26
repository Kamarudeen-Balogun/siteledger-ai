import { readSharedReport } from "@/lib/reports/sharing";
import { pdfResponse, pdfError } from "@/lib/pdf/export";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return await pdfResponse(await readSharedReport((await params).id)); }
  catch (error) { return pdfError(error); }
}
