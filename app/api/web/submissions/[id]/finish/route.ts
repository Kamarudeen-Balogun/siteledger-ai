import { finishWeb,webDependencies } from "@/lib/web/api";
import { UUID } from "@/lib/confirm/access";
import { after } from "next/server";
import { processSubmission } from "@/lib/ai/process-submission";
import { processSubmissionPhotos } from "@/lib/ai/process-photos";
export const maxDuration=300;
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  const {id}=await context.params;if(!UUID.test(id))return Response.json({error:"Site note unavailable."},{status:404});
  return finishWeb(request,id,webDependencies,saved=>after(async()=>{await Promise.all([processSubmission(saved),processSubmissionPhotos(saved)]);}));
}
