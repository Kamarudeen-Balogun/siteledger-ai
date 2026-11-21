import { uploadWeb } from "@/lib/web/api";
import { UUID } from "@/lib/confirm/access";
export const maxDuration=120;
export async function PUT(request:Request,context:{params:Promise<{id:string;index:string}>}) {
  const {id,index}=await context.params;
  if(!UUID.test(id)||!/^[0-5]$/.test(index))return Response.json({error:"Upload unavailable."},{status:404});
  return uploadWeb(request,id,Number(index));
}
