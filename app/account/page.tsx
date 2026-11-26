import { Suspense } from "react";
import Link from "next/link";
import { currentAccount, accountForHash, currentSessionHash } from "@/lib/auth/session";
import { AccountLogin, AccountSignOut, EmailProof, ProfessionalProfile, TelegramAccountEntry, TelegramLink, TelegramConnect } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { ThemeSettings } from "@/components/diary-theme";
import { ReplayTour } from "@/components/diary-tour";
import { DiaryNotice } from "@/components/diary-notice";
import { AccountSecurity } from "@/components/account-security";
import { UUID } from "@/lib/confirm/access";
import { intakeRpc } from "@/lib/telegram/storage";
import { privateProjects } from "@/lib/projects/data";
import { ProfilePhoto, ProfilePhone } from "@/components/profile-photo";
import { MockProjectControl } from "@/components/mock-project";
export const metadata={title:"Your account — SiteLedger AI",robots:{index:false,follow:false}};
async function AccountContent({ searchParams }: { searchParams: Promise<{ section?: string; project?: string }> }) {
  const account = await currentAccount(), siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  if (!account) return <><TelegramAccountEntry /><AccountLogin siteKey={siteKey}/><Link href="/help" className="text-link mt-5">Need help signing in?</Link></>;
  const query=await searchParams, requested = query.section ?? "overview";
  if(requested==="security"){const recent=Boolean(await accountForHash(await currentSessionHash(),true));return <>{account.source==="browser"?<AccountSecurity siteKey={siteKey} recent={recent} projectId={query.project&&UUID.test(query.project)?query.project:undefined}/>:<AccountLogin siteKey={siteKey} telegramAccount={account} purpose="security"/>}<Link href="/account" className="text-link mt-5">Account overview</Link></>;}
  const section = ["profile", "telegram", "email"].includes(requested) ? requested : "overview";
  const [details,projects]=await Promise.all([intakeRpc<{phone:string|null;photo_path:string|null}|null>("account_profile_details",{p_hash:await currentSessionHash(),p_update:null}).catch(()=>null),privateProjects()]);
  const project=projects?.projects.find(project=>project.id===projects.active_project_id);
  const feedbackOwner=Boolean(account.email_verified&&account.email&&account.email.toLowerCase()===process.env.SITELEDGER_FEEDBACK_OWNER_EMAIL?.toLowerCase());
  return <div className="settings-layout"><nav aria-label="Account sections" className="work-tabs settings-nav">{[["overview","Overview"],["profile","Profile"],["telegram","Telegram"],["email","Email"]].map(([key,label])=><Link key={key} href={key==="overview"?"/account":`/account?section=${key}`} prefetch={false} aria-current={section===key?"page":undefined}>{label}</Link>)}</nav><div className="settings-content">
    {section==="overview"&&<>
      <section className="diary-panel" data-tour="profile-card"><div className="flex items-center gap-4"><ProfilePhoto name={account.professional_name??""} hasPhoto={Boolean(details?.photo_path)}/><div><h1>{account.professional_name ?? "Your profile"}</h1>{project&&<p>{project.role_label??(project.role==="pm"?"PM/QS":"Foreman")} · {project.name}</p>}</div></div><dl className="settings-summary"><div><dt>Email</dt><dd>{account.email ?? "No email shown"}</dd><Link href="/account?section=email">Manage email</Link></div><div><dt>Phone</dt><dd>{details?.phone??"Not added"}</dd></div><div><dt>Telegram</dt><dd>{account.telegram_linked?"Linked":"Not linked"}</dd><Link href="/account?section=telegram">{account.telegram_linked?"Manage Telegram":"Connect Telegram"}</Link></div></dl><Link href="/account?section=profile" className="work-button">Edit profile</Link></section>
      <section className="diary-panel" data-tour="profile-settings"><h2>Settings</h2><ul className="diary-list"><li><Link href="/projects">Projects &amp; team</Link></li><li><Link href="/help">Help</Link></li><li><Link href="/about">About SiteLedger</Link></li><li><Link href="/account/feedback">Send feedback</Link></li><li><Link href="/account/feedback?view=history">My feedback</Link></li>{feedbackOwner&&<li><Link href="/account/feedback?view=admin">Feedback inbox</Link></li>}</ul><ThemeSettings/><ReplayTour/></section>
      <MockProjectControl person={account.profile_id} restore/><div data-tour="sign-out"><AccountSignOut account={account}/></div>
      <Link href={feedbackOwner?"/account/deletion?view=admin":"/account/deletion"} className="text-link mt-3">{feedbackOwner?"Review deletion requests":"Request account deletion"}</Link>
    </>}
    {section==="profile"&&<><ProfessionalProfile account={account}/><ProfilePhone value={details?.phone??""}/></>}
    {section==="email"&&(account.source==="telegram"?<AccountLogin siteKey={siteKey} telegramAccount={account}/>:<EmailProof siteKey={siteKey} account={account}/>)}
    {section==="telegram"&&<><TelegramConnect account={account} siteKey={siteKey}/>{account.source==="browser"?<TelegramLink siteKey={siteKey} account={account}/>:<p className="my-5">Telegram is connected to your website account. To change this connection, <Link href="/account?section=email" className="underline">sign in with your email</Link> first.</p>}</>}
  </div></div>;
}
export default function AccountPage(props: { searchParams: Promise<{section?:string;project?:string}> }) {
  return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="account"/><Suspense fallback={<DiaryNotice busy title="Opening your account…"/>}><AccountContent {...props}/></Suspense></main>;
}
