import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { WorkspaceHeader } from "@/components/workspace-header";
import { PageLoading } from "@/components/page-loading";
import { FeedbackForm, FeedbackHistory } from "@/components/feedback-form";
import { currentAccount,currentSessionHash } from "@/lib/auth/session";
import { privateProjects } from "@/lib/projects/data";
import { feedbackData } from "@/lib/feedback/data";

async function Content({searchParams}:{searchParams:Promise<{view?:string}>}) {
  const [account,params]=await Promise.all([currentAccount(),searchParams]);
  if(!account)redirect("/account");
  const hash=await currentSessionHash();
  if(params.view==="admin"||params.view==="history"){
    const data=await feedbackData(hash,params.view==="history");
    if(!data||(params.view==="admin"&&!data.admin))notFound();
    return <><WorkspaceHeader current="account" title={params.view==="admin"?"Feedback Inbox":"My Feedback"} hideProfile/><FeedbackHistory items={data.items} admin={params.view==="admin"&&data.admin}/></>;
  }
  const list=await privateProjects();
  return <><WorkspaceHeader current="account" title="Send Feedback" hideProfile/><FeedbackForm name={account.professional_name??"SiteLedger user"} email={account.email} project={list?.projects.find(project=>project.id===list.active_project_id)?.name}/></>;
}
export default function Page(props:{searchParams:Promise<{view?:string}>}) {
  return <main className="mx-auto max-w-5xl px-5 py-7"><Suspense fallback={<PageLoading title="Opening feedback…" variant="form" header={<WorkspaceHeader current="account" title="Feedback" hideProfile/>}/>}><Content {...props}/></Suspense></main>;
}
