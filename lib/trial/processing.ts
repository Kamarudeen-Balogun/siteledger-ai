import "server-only";
import { randomUUID } from "node:crypto";
import { intakeRpc } from "../telegram/storage";
import { readEvidence } from "../confirm/data";
import { transcribeAndExtract } from "../ai/transcribe-and-extract";
import { analysePhoto } from "../ai/analyse-photo";
import type { TrialState } from "./types";
export async function processTrial(hash:string){const owner=randomUUID();let state:TrialState|null=null;
  try{
    state=await intakeRpc("trial_claim_processing",{p_hash:hash,p_owner:owner});if(!state?.record)return;
    const audio=await readEvidence(state.record.audio_url!,true);
    const result=await transcribeAndExtract({bytes:new Uint8Array(audio.bytes),contentType:state.manifest!.assets[0].content_type,filename:state.record.audio_url!.split("/").at(-1)!},state.prices.map(price=>({description:price.description,unit:price.unit})),{onTranscript:transcript=>intakeRpc("trial_save_transcript",{p_hash:hash,p_owner:owner,p_text:transcript.text})});
    const findings=[];
    for(const photo of state.record.photos){try{const stored=await readEvidence(photo.storage_url,false);const result=await analysePhoto({bytes:new Uint8Array(stored.bytes),contentType:"image/jpeg"});findings.push({id:photo.id,findings:result.findings});}catch{findings.push({id:photo.id,findings:null});}}
    await intakeRpc("trial_finish_processing",{p_hash:hash,p_owner:owner,p_extraction:result.extraction,p_findings:findings});
  }catch{if(state)await intakeRpc("trial_finish_processing",{p_hash:hash,p_owner:owner,p_extraction:null,p_findings:[]}).catch(()=>undefined);}
}
