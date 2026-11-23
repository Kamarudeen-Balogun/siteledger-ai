import { Suspense } from "react";
import Link from "next/link";
import { currentAccount } from "@/lib/auth/session";
import { AccountLogin, AccountSignOut, EmailProof, ProfessionalProfile, TelegramAccountEntry, TelegramLink, TelegramConnect } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { TrialReturnLink } from "@/components/trial-return-link";
import { DiaryNotice } from "@/components/diary-notice";
export const metadata={title:"Your account — SiteLedger AI",robots:{index:false,follow:false}};
async function AccountContent({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const account = await currentAccount(), siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  if (!account) return <><TelegramAccountEntry /><AccountLogin siteKey={siteKey}/><Link href="/help" className="text-link mt-5">Need help signing in?</Link></>;
  const requested = (await searchParams).section ?? "overview";
  const section = ["profile", "telegram", "email"].includes(requested) ? requested : "overview";
  return <div className="settings-layout"><nav aria-label="Account sections" className="work-tabs settings-nav">{[["overview","Overview"],["profile","Profile"],["telegram","Telegram"],["email","Email"]].map(([key,label])=><Link key={key} href={key==="overview"?"/account":`/account?section=${key}`} prefetch={false} aria-current={section===key?"page":undefined}>{label}</Link>)}</nav><div className="settings-content">
    {section==="overview"&&<>{account.source === "telegram" ? <AccountLogin siteKey={siteKey} telegramAccount={account}/> : <><TelegramConnect account={account} siteKey={siteKey}/><section className="work-state account-ready"><p className="eyebrow">Your workspace</p><h2>{account.name_confirmed_at ? `Ready, ${account.professional_name}` : "Finish your profile"}</h2><p>{account.name_confirmed_at?"Choose a project to record work or open its saved reports.":"Confirm the professional name that will appear on your site records."}</p><Link href={account.name_confirmed_at?"/projects":"/account?section=profile"} className="work-button work-button-primary mt-5">{account.name_confirmed_at?"Open your projects":"Complete profile"}</Link></section><dl className="settings-summary"><div><dt>Email</dt><dd>{account.email}<span>{account.email_verified?"Verified":"Verification needed"}</span></dd><Link href="/account?section=email">Manage email</Link></div><div><dt>Telegram</dt><dd>{account.telegram_linked?"Connected":"Not connected"}<span>{account.telegram_linked?"Website and chat use your linked identity":"Connect to send notes from chat"}</span></dd><Link href="/account?section=telegram">{account.telegram_linked?"Manage connection":"Connect Telegram"}</Link></div></dl></> }<AccountSignOut account={account}/></>}
    {section==="profile"&&<ProfessionalProfile account={account}/>}
    {section==="email"&&(account.source==="telegram"?<AccountLogin siteKey={siteKey} telegramAccount={account}/>:<EmailProof siteKey={siteKey} account={account}/>)}
    {section==="telegram"&&<><TelegramConnect account={account} siteKey={siteKey}/>{account.source==="browser"?<TelegramLink siteKey={siteKey} account={account}/>:<p className="my-5">This Telegram account is connected. Add website access from the Email section.</p>}</>}
  </div></div>;
}
export default function AccountPage(props: { searchParams: Promise<{section?:string}> }) {
  return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="account" title="Your account"/><Suspense fallback={null}><TrialReturnLink/></Suspense><Suspense fallback={<DiaryNotice busy title="Opening your account…">Checking your current session.</DiaryNotice>}><AccountContent {...props}/></Suspense></main>;
}
