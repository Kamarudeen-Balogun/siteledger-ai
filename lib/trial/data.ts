import "server-only";
import { intakeRpc } from "../telegram/storage";
import { currentTrialHash } from "./session";
import type { TrialState } from "./types";
import type { Confirmation } from "../confirm/validation";
import type { ReportDocument, ReportSource } from "../reports/model";
import { costReport } from "../costing/cost-report";
import type { BoqUnit } from "../costing/types";
export async function currentTrial(){const hash=await currentTrialHash();return hash?intakeRpc<TrialState|null>("trial_read",{p_hash:hash}):null;}
export function trialDocument(state:TrialState,input:Confirmation):ReportDocument {
  const record=state.record!;
  const source:ReportSource={submission_id:state.note_id,date:record.created_at.slice(0,10),status:"confirmed",project:{id:state.project_id,name:record.project_name,client:"Fictional demo client",location:"Demo workspace",is_demo:true,currency:"NGN",timezone:"Africa/Lagos"},submitted_by:record.submitted_by,confirmed_by:record.actor,confirmed_at:new Date().toISOString(),pending_media:false,processing:false,items:input.values.work_items.map((item,i)=>({boq_item_id:input.boq_ids[i],description:item.description,quantity_done:String(item.quantity),unit:item.unit as BoqUnit,crew:item.crew,confidence:String(item.confidence),confirmed_by:record.actor})),price_list:state.prices,materials:input.values.materials,delays:input.values.delays,issues:input.values.issues,photos:record.photos.map(photo=>({id:photo.id,storage_url:photo.storage_url,note:input.photo_notes.find(note=>note.id===photo.id)!.note}))};
  // Lagos site dates, including recordings close to midnight UTC.
  source.date=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(record.created_at));
  return {source,costing:costReport(source.items,source.price_list),firm_name:"SiteLedger AI / Private trial",currency:"NGN",weather:null};
}
