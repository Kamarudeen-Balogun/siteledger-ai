import { getReport } from "@/lib/reports/data";
import { pdfResponse, pdfError } from "@/lib/pdf/export";
import { requestSessionHash } from "@/lib/auth/session";
import { recordActor } from "@/lib/auth/record";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const hash=requestSessionHash(request);
    const response=await pdfResponse(await getReport(id,hash));
    if (!await recordActor(id,hash)) return new Response("Report unavailable.",{status:404,headers:{"Cache-Control":"private, no-store"}});
    return response;
  } catch (error) { return pdfError(error); }
}
