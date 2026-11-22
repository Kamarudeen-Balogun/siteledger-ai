import { Suspense } from "react";
import { currentTrial } from "@/lib/trial/data";
import { currentAccount } from "@/lib/auth/session";
import { TrialStart, TrialCapture, TrialHandover, TrialExpiry } from "@/components/trial-forms";
import { ConfirmForm } from "@/components/confirm-form";
import { WorkspaceHeader } from "@/components/workspace-header";
export const metadata={title:"Private trial — SiteLedger AI",robots:{index:false,follow:false},referrer:"no-referrer" as const};
async function Content(){const [state,account]=await Promise.all([currentTrial(),currentAccount()]),siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY??"";
  if(!state)return <main className="mx-auto max-w-6xl px-5 py-7 sm:px-10"><WorkspaceHeader current="account" title="Try a private site record"/><TrialStart siteKey={siteKey}/></main>;
  return <><div className="mx-auto max-w-5xl px-5 py-7 sm:px-8"><TrialExpiry expires={state.expires_at}/>{!state.record&&<TrialCapture state={state}/>}</div>{state.record&&<><ConfirmForm key={`${state.record.id}:${state.record.job_status}`} record={state.record} trial/><div className="mx-auto max-w-5xl px-5 sm:px-8"><TrialHandover account={account} siteKey={siteKey}/></div></>}</>;
}
export default function TrialPage(){return <Suspense fallback={<p role="status" className="p-7">Opening your private trial…</p>}><Content/></Suspense>;}
