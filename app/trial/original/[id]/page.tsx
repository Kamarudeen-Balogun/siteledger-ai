import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { currentSessionHash } from "@/lib/auth/session";
import { intakeRpc } from "@/lib/telegram/storage";
import { ReportDocument } from "@/components/report-document";
import type { ReportDocument as Document } from "@/lib/reports/model";
import { UUID } from "@/lib/confirm/access";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
export const metadata={title:"Original guest trial — SiteLedger AI",robots:{index:false,follow:false},referrer:"no-referrer" as const};
async function Original({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;if(!UUID.test(id))notFound();
  const hash=await currentSessionHash(),original=hash?await intakeRpc<{draft:Document|null;transcript:string|null;confirmed_values:unknown;origin:{recorded_by:string}}|null>("trial_original",{p_hash:hash,p_id:id}):null;
  if(!original)notFound();
  return <><h1 className="font-serif text-3xl">Original guest trial</h1><p className="my-5 leading-7">Captured by {original.origin.recorded_by}. This preserved original is separate from later verified confirmation and approval.</p><Link href={`/confirm/${id}`} className="mb-6 inline-flex min-h-12 items-center underline">Open the account site record</Link>
    {original.draft ? <ReportDocument guestOriginal report={{id,status:"draft",approved_by:null,locked_at:null,stale:false,document:original.draft}}/> : <p className="whitespace-pre-wrap leading-7">{original.transcript??"No transcript was generated. Original media is available on the account site note."}</p>}
  </>;
}
export default function OriginalPage(props:{params:Promise<{id:string}>}){return <main className="mx-auto max-w-6xl px-5 py-7 sm:px-10"><WorkspaceHeader current="reports"/><Suspense fallback={<DiaryNotice busy title="Opening preserved trial work…">Checking access to the original guest record.</DiaryNotice>}><Original {...props}/></Suspense></main>;}
