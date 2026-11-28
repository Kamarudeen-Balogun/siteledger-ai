import Link from "next/link";
import { Suspense } from "react";
import { currentTrial } from "@/lib/trial/data";
import { currentAccount } from "@/lib/auth/session";
import { TrialExpiry, TrialHandover } from "@/components/trial-forms";
import { ReportDocument } from "@/components/report-document";
import { PublicSite } from "@/components/public-site";
import { PageLoading } from "@/components/page-loading";
export const metadata={title:"Trial draft — SiteLedger AI",robots:{index:false,follow:false},referrer:"no-referrer" as const};
async function Draft(){const[state,account]=await Promise.all([currentTrial(),currentAccount()]);if(!state?.draft)return <p className="my-6 font-body-md text-body-md leading-relaxed text-on-surface-variant">No active trial draft. <Link href="/trial" className="underline text-primary">Open your trial</Link> and confirm the work first.</p>;return <><TrialExpiry expires={state.expires_at}/><p className="mb-6 rounded-lg border-l-4 border-primary-container bg-surface-container-low p-4 font-body-md text-body-md leading-relaxed text-on-surface">Private trial draft. Save to a verified account before approval or sharing a client PDF.</p><TrialHandover account={account} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY??""}/><Link href="/trial" className="mb-5 inline-flex min-h-12 items-center font-label-ledger text-label-ledger text-primary underline">Review trial quantities</Link><ReportDocument trial report={{id:state.note_id,status:"draft",approved_by:null,locked_at:null,stale:false,document:state.draft}}/></>;}
export default function TrialReport(){return <PublicSite current="/trial"><div className="public-column pb-10 pt-4"><Link href="/trial" className="text-link">Back to trial</Link><Suspense fallback={<PageLoading title="Opening your private draft…" detail="Loading your checked quantities and saved photos." variant="report"/>}><Draft/></Suspense></div></PublicSite>;}
