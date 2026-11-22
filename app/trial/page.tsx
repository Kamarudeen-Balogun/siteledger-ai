import { Suspense } from "react";
import { currentTrial } from "@/lib/trial/data";
import { currentAccount } from "@/lib/auth/session";
import { TrialStart, TrialCapture, TrialHandover, TrialExpiry } from "@/components/trial-forms";
import { ConfirmForm } from "@/components/confirm-form";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
export const metadata={title:"Private trial — SiteLedger AI",robots:{index:false,follow:false},referrer:"no-referrer" as const};
async function Content(){const [state,account]=await Promise.all([currentTrial(),currentAccount()]),siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY??"";
  if(!state)return <main className="mx-auto max-w-6xl px-5 py-7 sm:px-10"><WorkspaceHeader current="account" title="Try a private site record"/><TrialStart siteKey={siteKey}/></main>;
  if (!state.record) return <main className="mx-auto max-w-6xl px-5 py-7 sm:px-10"><WorkspaceHeader current="reports" title="Your private trial"/><TrialExpiry expires={state.expires_at}/><TrialCapture state={state}/></main>;
  return <ConfirmForm key={`${state.record.id}:${state.record.job_status}`} record={state.record} trial banner={<TrialExpiry expires={state.expires_at}/>}><TrialHandover account={account} siteKey={siteKey}/></ConfirmForm>;
}
export default function TrialPage(){return <Suspense fallback={<main className="mx-auto max-w-6xl px-5 py-7"><DiaryNotice busy title="Opening your private trial…">Checking the trial session and its expiry.</DiaryNotice></main>}><Content/></Suspense>;}
