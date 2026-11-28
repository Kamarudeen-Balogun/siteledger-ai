import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { currentSessionHash } from "@/lib/auth/session";
import { intakeRpc } from "@/lib/telegram/storage";
import { ReportDocument } from "@/components/report-document";
import type { ReportDocument as Document } from "@/lib/reports/model";
import { UUID } from "@/lib/confirm/access";
import { PublicSite } from "@/components/public-site";
import { PageLoading } from "@/components/page-loading";
export const metadata={title:"Original guest trial — SiteLedger AI",robots:{index:false,follow:false},referrer:"no-referrer" as const};
async function Original({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;if(!UUID.test(id))notFound();
  const hash=await currentSessionHash(),original=hash?await intakeRpc<{draft:Document|null;transcript:string|null;confirmed_values:unknown;origin:{recorded_by:string}}|null>("trial_original",{p_hash:hash,p_id:id}):null;
  if(!original)notFound();
  return <><h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Original guest trial</h1><p className="my-5 font-body-md text-body-md leading-relaxed text-on-surface-variant">Captured by {original.origin.recorded_by}. This preserved original is separate from later verified confirmation and approval.</p><Link href={`/confirm/${id}`} className="mb-6 inline-flex min-h-12 items-center font-label-ledger text-label-ledger text-primary underline">Open the account site record</Link>
    {original.draft ? <ReportDocument guestOriginal report={{id,status:"draft",approved_by:null,locked_at:null,stale:false,document:original.draft}}/> : <p className="whitespace-pre-wrap font-body-md text-body-md leading-relaxed text-on-surface-variant">{original.transcript??"No transcript was generated. Original media is available on the account site note."}</p>}
  </>;
}
export default function OriginalPage(props:{params:Promise<{id:string}>}){return <PublicSite current="/trial"><div className="public-column pb-10 pt-4"><Suspense fallback={<PageLoading title="Opening preserved trial work…" detail="Checking access to the original guest record." variant="report"/>}><Original {...props}/></Suspense></div></PublicSite>;}
