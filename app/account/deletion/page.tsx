import { Suspense } from "react";
import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { currentAccount,currentSessionHash } from "@/lib/auth/session";
import { intakeRpc } from "@/lib/telegram/storage";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
import { RequestDeletion, ReviewDeletions, type DeletionItem } from "@/components/account-deletion";

export const metadata={title:"Account deletion — SiteLedger",robots:{index:false,follow:false}};
async function Content({searchParams}:{searchParams:Promise<{view?:string}>}) {
  const [account,query,hash]=await Promise.all([currentAccount(),searchParams,currentSessionHash()]);
  if(!account)redirect("/account");
  const admin=process.env.SITELEDGER_FEEDBACK_OWNER_EMAIL??"";
  const args={p_hash:hash,p_admin_email:admin,p_value:null};
  if(query.view==="admin"){
    const items=await intakeRpc<DeletionItem[]|null>("account_deletion",{...args,p_action:"list"});
    if(!items)notFound();return <ReviewDeletions items={items}/>;
  }
  if(!account.email_verified||!account.email)return <DiaryNotice title="Use your verified email"><Link href="/account?section=email" className="text-link">Open email settings</Link></DiaryNotice>;
  if(account.email.toLowerCase()===admin.toLowerCase())return <DiaryNotice title="Administrator account"><Link href="/account/deletion?view=admin" className="text-link">Review account deletion requests</Link></DiaryNotice>;
  const state=await intakeRpc<{requested:boolean}|null>("account_deletion",{...args,p_action:"status"});
  return <RequestDeletion email={account.email} pending={Boolean(state?.requested)}/>;
}
export default function Page(props:{searchParams:Promise<{view?:string}>}) {
  return <main className="mx-auto max-w-5xl px-5 py-7"><WorkspaceHeader current="account" title="Account deletion" hideProfile/><Suspense fallback={<DiaryNotice busy title="Opening account deletion…"/>}><Content {...props}/></Suspense></main>;
}
