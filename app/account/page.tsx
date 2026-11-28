import { Suspense } from "react";
import type { ComponentProps } from "react";
import Link from "next/link";
import { currentAccount, accountForHash, currentSessionHash } from "@/lib/auth/session";
import { AccountLogin, AccountSignOut, EmailProof, ProfessionalProfile, TelegramAccountEntry, TelegramLink, TelegramConnect } from "@/components/account-forms";
import { PublicSite } from "@/components/public-site";
import { WorkspaceHeader } from "@/components/workspace-header";
import { ThemeSettings } from "@/components/diary-theme";
import { ReplayTour } from "@/components/diary-tour";
import { PageLoading } from "@/components/page-loading";
import { AccountSecurity } from "@/components/account-security";
import { UUID } from "@/lib/confirm/access";
import { intakeRpc } from "@/lib/telegram/storage";
import { privateProjects } from "@/lib/projects/data";
import { ProfilePhoto, ProfilePhone } from "@/components/profile-photo";
import { MockProjectControl } from "@/components/mock-project";
import { DiaryIcon } from "@/components/diary-icon";
export const metadata={title:"Your account — SiteLedger AI",robots:{index:false,follow:false}};
async function AccountContent({ searchParams }: { searchParams: Promise<{ section?: string; project?: string }> }) {
  const account = await currentAccount(), siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  if (!account) return <PublicSite current="account"><div className="mx-auto w-full max-w-md px-4 pb-16 pt-8"><TelegramAccountEntry /><AccountLogin siteKey={siteKey}/><Link href="/help" className="mt-5 inline-flex min-h-12 items-center font-label-ledger text-label-ledger text-primary hover:underline">Need help signing in?</Link></div></PublicSite>;
  const query=await searchParams, requested = query.section ?? "overview";
  if(requested==="security"){const recent=Boolean(await accountForHash(await currentSessionHash(),true));return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="account" title="Confirm website access"/>{account.source==="browser"?<AccountSecurity siteKey={siteKey} recent={recent} projectId={query.project&&UUID.test(query.project)?query.project:undefined}/>:<AccountLogin siteKey={siteKey} telegramAccount={account} purpose="security"/>}<Link href="/account" className="text-link mt-5">Account overview</Link></main>;}
  const section = ["profile", "telegram", "email"].includes(requested) ? requested : "overview";
  const [details,projects]=await Promise.all([intakeRpc<{phone:string|null;photo_path:string|null;company:string|null}|null>("account_profile_details",{p_hash:await currentSessionHash(),p_update:null}).catch(()=>null),privateProjects()]);
  const project=projects?.projects.find(project=>project.id===projects.active_project_id);
  const feedbackOwner=Boolean(account.email_verified&&account.email&&account.email.toLowerCase()===process.env.SITELEDGER_FEEDBACK_OWNER_EMAIL?.toLowerCase());
  const role=project?.role_label??(project?.role==="pm"?"PM/QS":project?.role==="foreman"?"Foreman":"No active project role");
  const settings: (readonly [ComponentProps<typeof DiaryIcon>["name"], string, string, string])[] = [
    ["help","/help","Help & Support","How to use SiteLedger"], ["info","/about","About","SiteLedger and its builder"],
    ["feedback","/account/feedback","Send feedback","Report a bug or suggest an improvement"], ["receipt","/account/feedback?view=history","My feedback","Read updates and replies"],
    ["email","/account?section=email","Email & password","Manage account access"],
    ["telegram","/account?section=telegram",account.telegram_linked?"Telegram connection":"Link Telegram","Manage your Telegram account"],
    ...(feedbackOwner?[["feedback","/account/feedback?view=admin","Feedback inbox","Review and reply to feedback"],["review","/account/deletion?view=admin","Review deletion requests","Check verified account deletion requests"]] as const:[["trash","/account/deletion","Request account deletion","Delete your account after review"]] as const),
  ];
  return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="account" title={{overview:"My Profile",profile:"Edit Profile",telegram:"Telegram",email:"Email & Password"}[section]}/>
  <div className="stitch-profile">
    {section==="overview"&&<>
      <section className="stitch-card stitch-profile-card" data-tour="profile-card">
        <div className="stitch-profile-heading"><ProfilePhoto name={account.professional_name??""} hasPhoto={Boolean(details?.photo_path)}/><div>
          <h1>{account.professional_name ?? "Your profile"}</h1><p>{role}</p><small>Tap your photo to change it</small>
        </div></div>
        <dl className="stitch-profile-values">{[
          ["Full name",account.professional_name??"Not added"],["Email",account.email??"Sign in with email to view it"],["Role",role],
          ...(details?.company?[["Company / Firm",details.company]] as const:[]),
          ["Phone",details?.phone??"Not added"],["Telegram",account.telegram_linked?"Linked":"Not linked"],["Current project",project?.name??"Select a project"],
        ].map(([label,value])=><div key={label}><dt className="stitch-kicker">{label}</dt><dd>{value}</dd></div>)}</dl>
        <Link href="/account?section=profile" className="stitch-button" data-primary>Edit profile</Link>
      </section>
      <section className="stitch-card stitch-profile-settings" data-tour="profile-settings"><h2>Settings</h2><ThemeSettings/>
        <ul className="stitch-menu-list">{settings.map(([icon,href,label,subtitle])=><li key={href}><Link href={href} className="stitch-menu-row"><DiaryIcon name={icon} size={20}/><span><strong>{label}</strong><small>{subtitle}</small></span><DiaryIcon name="chevron" size={18}/></Link></li>)}</ul>
        <MockProjectControl person={account.profile_id} restore/><ReplayTour signedIn/>
      </section>
      <div data-tour="sign-out"><AccountSignOut account={account}/></div>
    </>}
    {section==="profile"&&<><ProfessionalProfile account={account}/><ProfilePhone value={details?.phone??""}/></>}
    {section==="email"&&(account.source==="telegram"?<AccountLogin siteKey={siteKey} telegramAccount={account}/>:<EmailProof siteKey={siteKey} account={account}/>)}
    {section==="telegram"&&<><TelegramConnect account={account} siteKey={siteKey}/>{account.source==="browser"?<TelegramLink siteKey={siteKey} account={account}/>:<p className="my-5">Telegram is connected to your website account. To change this connection, <Link href="/account?section=email" className="underline">sign in with your email</Link> first.</p>}</>}
  </div></main>;
}
export default function AccountPage(props: { searchParams: Promise<{section?:string;project?:string}> }) {
  return <Suspense fallback={<main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><PageLoading title="Opening your account…" header={<WorkspaceHeader current="account"/>}/></main>}><AccountContent {...props}/></Suspense>;
}
