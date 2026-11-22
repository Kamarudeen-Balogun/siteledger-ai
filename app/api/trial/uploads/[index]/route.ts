import { uploadTrial, trialHeaders } from "@/lib/trial/api";
export async function PUT(request:Request,{params}:{params:Promise<{index:string}>}){const {index}=await params;if(!/^[0-3]$/.test(index))return Response.json({error:"Trial file unavailable."},{status:404,headers:trialHeaders});return uploadTrial(request,Number(index));}
