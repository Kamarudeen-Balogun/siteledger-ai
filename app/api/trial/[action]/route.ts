import { after } from "next/server";
import { trialApi } from "@/lib/trial/api";
import { processTrial } from "@/lib/trial/processing";
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){return trialApi(request,(await params).action,undefined,hash=>after(()=>processTrial(hash)));}
