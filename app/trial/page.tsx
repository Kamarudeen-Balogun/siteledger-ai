import { Suspense } from "react";
import { currentTrial } from "@/lib/trial/data";
import { currentAccount } from "@/lib/auth/session";
import { TrialStart, TrialCapture, TrialExpiry } from "@/components/trial-forms";
import { ConfirmForm } from "@/components/confirm-form";
import { PublicSite } from "@/components/public-site";
import { DiaryNotice } from "@/components/diary-notice";
import { redirect } from "next/navigation";
export const metadata={title:"Private trial — SiteLedger AI",robots:{index:false,follow:false},referrer:"no-referrer" as const};
async function Content(){const [state,account]=await Promise.all([currentTrial(),currentAccount()]),siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY??"";
  if(!state&&account)redirect("/today");
  if(!state)return <PublicSite current="/trial"><div className="public-column pb-10 pt-4"><TrialStart siteKey={siteKey}/></div></PublicSite>;
  if (!state.record) return <PublicSite current="/trial"><div className="public-column pb-10 pt-4"><TrialExpiry expires={state.expires_at}/><TrialCapture state={state}/></div></PublicSite>;
  return <ConfirmForm key={`${state.record.id}:${state.record.job_status}`} record={state.record} trial banner={<TrialExpiry expires={state.expires_at}/>}/>;
}
export default function TrialPage(){return <Suspense fallback={<main className="mx-auto max-w-6xl px-5 py-7"><DiaryNotice busy title="Opening your private trial…">Checking the trial session and its expiry.</DiaryNotice></main>}><Content/></Suspense>;}
