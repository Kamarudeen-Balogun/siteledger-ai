import { verifyTelegramAccess } from "@/lib/confirm/telegram-access";
import { verifyReviewToken } from "@/lib/confirm/access";
import { captureAccess } from "@/lib/web/access";
import { intakeRpc } from "@/lib/telegram/storage";
import type { CaptureContext } from "@/lib/web/types";
const headers = {"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
export async function POST(request: Request) {
  if(request.headers.get("origin") !== process.env.SITELEDGER_APP_URL) return Response.json({error:"Open your authorized site diary."},{status:403,headers});
  if(Number(request.headers.get("content-length")??0)>12000) return Response.json({error:"Access request is too large."},{status:413,headers});
  try {
    const text = await request.text(); if(text.length > 12000) return Response.json({error:"Access request is too large."},{status:413,headers});
    const input = JSON.parse(text); let actor: number | null = null;let review:string|null=null;
    if(input && Object.keys(input).length === 1 && typeof input.init_data === "string") actor=verifyTelegramAccess(input.init_data,process.env.TELEGRAM_BOT_TOKEN??"");
    else if(input && Object.keys(input).length === 2 && typeof input.review_id === "string" && typeof input.access === "string") {
      const claims=verifyReviewToken(input.access,input.review_id,process.env.TELEGRAM_WEBHOOK_SECRET??"");
      if(claims){actor=claims.telegramId;review=input.review_id;}
    }
    if(!actor) return Response.json({error:"Reopen SiteLedger from your private review link or Telegram bot menu."},{status:401,headers});
    const context=await intakeRpc<Omit<CaptureContext,"access"|"expires"> | null>(review?"web_capture_context_from_review":"web_capture_context",review?{p_actor:actor,p_review:review}:{p_actor:actor});
    if(!context) return Response.json({error:"Project access is unavailable. Your queued notes stay on this device."},{status:403,headers});
    return Response.json(captureAccess(context,process.env.TELEGRAM_WEBHOOK_SECRET??""),{headers});
  } catch {return Response.json({error:"Could not connect. Try again when data returns."},{status:503,headers});}
}
