import type { Asset } from "../web/types";
import { validManifest } from "../web/types";
import type { ReviewRecord } from "../confirm/data";
import type { ReportDocument } from "../reports/model";
import type { BoqPrice } from "../costing/types";
export const TRIAL_HOURS=24;
export const TRIAL_COOKIE="siteledger_trial";
export type TrialManifest={captured_at:string;timezone:"Africa/Lagos";assets:Asset[]};
export function validTrialManifest(value:unknown):value is TrialManifest {
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const input=value as TrialManifest;
  if(Object.keys(input).length!==3||input.timezone!=="Africa/Lagos"||!Array.isArray(input.assets)||input.assets.length<1||input.assets.length>4)return false;
  return validManifest({...input,id:"00000000-0000-4000-8000-000000000001",project_id:"00000000-0000-4000-8000-000000000002"},true);
}
export type TrialState={id:string;project_id:string;note_id:string;created_at:string;expires_at:string;manifest:TrialManifest|null;status:"empty"|"uploading"|"processing"|"ready";record:ReviewRecord|null;draft:ReportDocument|null;prices:(BoqPrice&{description:string;section:string;item_code:string})[];missing:number[]};
