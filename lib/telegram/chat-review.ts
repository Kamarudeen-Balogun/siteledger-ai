import "server-only";
import { appOrigin } from "../app-url";
import { randomBytes } from "node:crypto";
import { intakeRpc } from "./storage";
import { sendTelegramPdf, telegramCall } from "./api";
import { getReview, type ReviewRecord } from "../confirm/data";
import { validateConfirmation, type Confirmation } from "../confirm/validation";
import { suggestedPhotoNote, validatePhotoAnalysis } from "../ai/photo-schema";
import { createReport, getReport } from "../reports/data";
import { approveReport, reportVersion } from "../log/data";
import { formatMoney } from "../costing/format-money";
import { displayUnit } from "../reports/model";
import { suppliedDecimal } from "../projects/boq-input";
import { recordActor } from "../auth/record";

type Action = "review" | "confirm" | "edit" | "lock" | "share";
type TicketPayload = { confirmation?: Confirmation; version?: string };
type Ticket = { action: Action; id: string; payload: TicketPayload | null; can_approve: boolean };
type Button = { text: string; callback_data?: string; url?: string };
export type ChatReview = { telegram: number; ticket: string; update: string; edit?: string };
const uuid="[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const callback=new RegExp(`^sl:(${uuid})$`);
const editText=new RegExp(`^/qty (${uuid}) (.{1,600})$`);
const object=(value:unknown)=>value&&typeof value==="object"?value as Record<string,unknown>:null;

export function parseChatReview(value:unknown):ChatReview|null {
  const update=object(value),query=object(update?.callback_query),message=object(query?.message??update?.message),chat=object(message?.chat),from=object(query?.from??message?.from);
  if(!message||!chat||!from||chat.type!=="private"||from.id!==chat.id||typeof from.id!=="number"||!Number.isSafeInteger(from.id)||from.id<=0||from.is_bot===true)return null;
  const token=query&&typeof query.data==="string"&&typeof query.id==="string"?callback.exec(query.data):null;
  if(token)return {telegram:from.id,ticket:token[1],update:String(query?.id)};
  const edit=typeof message.text==="string"?editText.exec(message.text):null;
  return edit?{telegram:from.id,ticket:edit[1],update:"",edit:edit[2]}:null;
}

async function button(telegram:number,id:string,action:Action,text:string,payload?:TicketPayload):Promise<Button|null> {
  const ticket=await intakeRpc<string|null>("telegram_review_ticket",{p_telegram:telegram,p_submission:id,p_action:action,p_payload:payload??null});
  return ticket?{text,callback_data:`sl:${ticket}`}:null;
}
export function telegramReviewButton(telegram:number,id:string) { return button(telegram,id,"review","Review in Telegram"); }

export async function sendTelegramProjectList(telegram: number): Promise<boolean> {
  const data=await intakeRpc<{name:string;selected:boolean;code:string}[]|null>("telegram_project_choices",{p_telegram:telegram});
  if(!data?.length)return false;
  await send(telegram,"Your projects. Choose where to record today's work.",data.map(item=>({
    text:`${item.selected?"✓ ":""}${item.name.slice(0,54)}`,
    callback_data:`slp:${item.code}`,
  })));
  return true;
}

export async function sendTelegramReports(telegram: number): Promise<boolean> {
  const data=await intakeRpc<{project:string;notes:{id:string;date:string;status:string;label:string}[]}|null>("telegram_recent_reports",{p_telegram:telegram});
  if(!data)return false;
  const actions=await Promise.all(data.notes.map(note=>button(telegram,note.id,"review",`${note.date} · ${note.label}`)));
  await send(telegram,`${data.project} — ${data.notes.length?"recent site records":"send a voice note or site photos to begin"}.`,actions);
  return true;
}

async function send(telegram:number,text:string,buttons:(Button|null)[]=[]){
  const options=buttons.filter((entry):entry is Button=>Boolean(entry));
  await telegramCall("sendMessage",{chat_id:telegram,text,...(options.length?{reply_markup:{inline_keyboard:options.map(option=>[option])}}:{})});
}
function suggestions(record:ReviewRecord):Confirmation|null {
  const values=record.confirmed_extraction??record.extraction??(record.photos.length?{work_items:[],materials:[],delays:[],issues:[],raw_language_notes:""}:null);
  if(!values)return null;
  return {human_confirmed:true,values,boq_ids:record.confirmed_boq_ids??values.work_items.map(item=>{
    const candidates=record.boq.filter(row=>row.description.toLowerCase()===item.matched_boq_hint?.toLowerCase()&&row.unit===item.unit);
    return candidates.length===1?candidates[0].id:"";
  }),photo_notes:record.photos.map(photo=>({id:photo.id,note:photo.confirmed_findings?.note??(validatePhotoAnalysis(photo.ai_findings)?suggestedPhotoNote(photo.ai_findings):"")}))};
}
function siteLink(path:string) {return new URL(path,appOrigin()).toString();}

function reportSummary(report: NonNullable<Awaited<ReturnType<typeof getReport>>>) {
  const {source,currency,costing}=report.document;
  const items=costing.items.slice(0,12).map((item,index)=>`• ${source.items[index].description.slice(0,88)} · ${item.quantity_done} ${displayUnit(item.unit)} · ${formatMoney(item.cost_today,currency)}`);
  return [`${report.status==="locked"?"Locked report":"Draft report"} · ${formatMoney(costing.total_cost,currency)}`,...items].join("\n");
}

export async function handleChatReview(request:ChatReview) {
  const {telegram,ticket,update,edit}=request;
  if(update)await telegramCall("answerCallbackQuery",{callback_query_id:update}).catch(()=>undefined);
  void telegramCall("sendChatAction",{chat_id:telegram,action:"typing"}).catch(()=>undefined);
  const hash=randomBytes(32).toString("hex");
  try{
    const action=await intakeRpc<Ticket|null>("telegram_use_review_ticket",{p_telegram:telegram,p_ticket:ticket,p_hash:hash,p_edit:edit!==undefined});
    if(!action){await send(telegram,"This action expired or the selected project changed. Use /today to reopen the site note.");return;}
    const {id}=action;
    if(action.action==="lock"){
      const report=await getReport(id,hash);
      if(!report||report.stale||!action.payload?.version||reportVersion(report)!==action.payload.version){await send(telegram,"This report changed. Reopen it to check the current draft before approval.");return;}
      await approveReport(id,hash,action.payload.version);
      await send(telegram,"Report approved and locked.",[await button(telegram,id,"share","Share Report Link"),{text:"Open full report",url:siteLink(`/reports/${id}`)}]);
      try {
        const approved=await getReport(id,hash),actor=await recordActor(id,hash);
        if(approved?.status==="locked"&&actor&&actor.permissions?.view_reports!==false){
          const { pdfResponse } = await import("../pdf/export");
          const pdf=await pdfResponse(approved);
          const current=await recordActor(id,hash);
          if(pdf.ok&&current&&current.permissions?.view_reports!==false)await sendTelegramPdf(telegram,await pdf.arrayBuffer(),`Locked site report · ${approved.document.source.project.name}`);
        }
      } catch {
        await send(telegram,"Your report is locked. Use Open full report to download the PDF.",[{text:"Open full report",url:siteLink(`/reports/${id}`)}]).catch(()=>undefined);
      }
      return;
    }
    if(action.action==="share"){
      const share=await intakeRpc<{share_id:string|null}|null>("account_report_share",{p_hash:hash,p_submission:id,p_enable:true});
      if(!share?.share_id){await send(telegram,"The share link is unavailable. Check whether the report is locked and you can approve it.");return;}
      await send(telegram,"Anyone you send this link to can open this locked report and its PDF.",[{text:"Client report and PDF",url:siteLink(`/shared/${share.share_id}`)}]);return;
    }
    const [record,existing]=await Promise.all([getReview(id,hash),getReport(id,hash)]);
    if(existing?.status==="locked"||existing?.status==="draft"&&!existing.stale&&action.action==="review"){
      await send(telegram,reportSummary(existing),[
        existing.status==="draft"&&action.can_approve?await button(telegram,id,"lock","Approve & lock",{version:reportVersion(existing)}):null,
        existing.status==="locked"&&action.can_approve?await button(telegram,id,"share","Share Report Link"):null,
        existing.status==="draft"&&record&&!record.archived_at?await button(telegram,id,"edit","Edit quantities",{confirmation:suggestions(record)??undefined}):null,
        {text:"Open full report",url:siteLink(`/reports/${id}`)},
      ]);return;
    }
    if(!record||record.archived_at||record.status==="locked"){await send(telegram,"This site note is unavailable for review.");return;}
    if(record.pending_media||record.pending_photo_analysis||["queued","processing"].includes(record.job_status??"")){
      await send(telegram,"Your note is still processing. Tap Review again in a moment.",[await button(telegram,id,"review","Review again")]);return;
    }
    const confirmation=action.payload?.confirmation??suggestions(record);
    if(!confirmation){await send(telegram,"We couldn’t extract the work details from this note. Open the note to enter the quantities and observations.",[{text:"Open review",url:siteLink(`/confirm/${id}`)}]);return;}
    if(action.action==="edit"&&edit===undefined){
      await send(telegram,`Send an edit using this command:\n/qty ${ticket} 1=18\n\nUse the work item number before =. Put several changes on the same line separated by spaces. For a missing BoQ item or a different match, use Full review.`);return;
    }
    if(action.action==="edit"&&edit){
      for(const entry of edit.trim().split(/\s+/)){
        const match=/^(\d{1,3})=(\S+)$/.exec(entry),item=match&&confirmation.values.work_items[Number(match[1])-1];
        const quantity=match&&suppliedDecimal(match[2]);
        if(!item||!quantity||!/^\d{1,10}(\.\d{1,4})?$/.test(quantity)){await send(telegram,"Use a line number and a supplied quantity, for example 1=18.",[await button(telegram,id,"edit","Try again",{confirmation})]);return;}
        item.quantity=Number(quantity);
      }
    }
    const valid=validateConfirmation(confirmation,record.boq,record.photos.map(photo=>photo.id));
    if(action.action==="confirm"&&valid){
      const result=await intakeRpc<{error?:string;status?:string}>("account_confirm",{p_hash:hash,p_id:id,p_values:confirmation.values,p_boq_ids:confirmation.boq_ids,p_photo_notes:confirmation.photo_notes});
      if(result.error||result.status!=="confirmed"){await send(telegram,"Could not confirm this note. Open it again to review the latest details.");return;}
      await createReport(id,hash);
      const report=await getReport(id,hash);
      if(!report){await send(telegram,"Your note is confirmed. Open it to create the report.");return;}
      await send(telegram,`${reportSummary(report)}\nCheck the report before approving it.`,[
        action.can_approve?await button(telegram,id,"lock","Approve & lock",{version:reportVersion(report)}):null,{text:"Open draft",url:siteLink(`/reports/${id}`)}]);return;
    }
    const lines=confirmation.values.work_items.slice(0,12).map((item,index)=>`${index+1}. ${item.description.slice(0,95)} · ${item.quantity??"Check quantity"} ${displayUnit(item.unit??"")}${item.confidence<.6?" · Check":""}`);
    const materials=confirmation.values.materials.slice(0,5).map(item=>`${item.name.slice(0,60)} · ${item.quantity??"Check quantity"} ${item.unit??""}`);
    const delays=confirmation.values.delays.slice(0,3).map(item=>`${item.reason.slice(0,60)} · ${item.hours??"Check duration"} hr`);
    const issues=confirmation.values.issues.slice(0,3).map(item=>item.slice(0,85));
    const photoNotes=confirmation.photo_notes.map((photo,index)=>`Photo ${index+1}: ${photo.note.slice(0,85)||"No observation drafted"}`);
    const sizes=confirmation.values.work_items.length<=12&&confirmation.values.materials.length<=5&&confirmation.values.delays.length<=3&&confirmation.values.issues.length<=3;
    const abbreviated=confirmation.photo_notes.some(photo=>photo.note.length>85)||confirmation.values.issues.some(issue=>issue.length>85);
    const canConfirm=valid&&sizes&&!abbreviated&&(action.action==="edit"||confirmation.values.work_items.every(item=>item.confidence>=.6)||Boolean(record.confirmed_at));
    await send(telegram,[`Review · ${record.project_name.slice(0,120)}`,record.transcript?`Voice note: ${record.transcript.slice(0,260)}`:"",...lines,...(materials.length?["Materials recorded",...materials]:[]),...delays,...issues,...photoNotes,canConfirm?"Confirm only after checking the quantities and observations.":"Review the missing or uncertain details before costing."].filter(Boolean).join("\n"),[
      canConfirm?await button(telegram,id,"confirm","Confirm & cost",{confirmation}):null,lines.length?await button(telegram,id,"edit","Edit quantities",{confirmation}):null,{text:"Full review",url:siteLink(`/confirm/${id}`)}]);
  }catch{await send(telegram,"Could not finish this step. Your saved site records are still available. Use /today to reopen the project.").catch(()=>undefined);}
  finally{await intakeRpc("account_logout",{p_hash:hash,p_all:false}).catch(()=>undefined);}
}
