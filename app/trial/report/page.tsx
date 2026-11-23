import Link from "next/link";
import { Suspense } from "react";
import { currentTrial } from "@/lib/trial/data";
import { currentAccount } from "@/lib/auth/session";
import { TrialExpiry, TrialHandover } from "@/components/trial-forms";
import { ReportDocument } from "@/components/report-document";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
export const metadata={title:"Trial draft — SiteLedger AI",robots:{index:false,follow:false},referrer:"no-referrer" as const};
async function Draft(){const[state,account]=await Promise.all([currentTrial(),currentAccount()]);if(!state?.draft)return <p className="my-6 leading-7">No active trial draft. <Link href="/trial" className="underline">Open your trial</Link> and confirm the work first.</p>;return <><TrialExpiry expires={state.expires_at}/><p className="mb-6 border-l-4 border-accent p-4 leading-7">Private trial draft. Save to a verified account before approval or sharing a client PDF.</p><TrialHandover account={account} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY??""}/><Link href="/trial" className="mb-5 inline-flex min-h-12 items-center underline">Review trial quantities</Link><ReportDocument trial report={{id:state.note_id,status:"draft",approved_by:null,locked_at:null,stale:false,document:state.draft}}/></>;}
export default function TrialReport(){return <main className="mx-auto max-w-6xl px-5 py-7 sm:px-10"><WorkspaceHeader current="reports"/><Suspense fallback={<DiaryNotice busy title="Opening your private draft…">Loading your checked quantities and saved photos.</DiaryNotice>}><Draft/></Suspense></main>;}
