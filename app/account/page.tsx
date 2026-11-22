import { Suspense } from "react";
import Link from "next/link";
import { currentAccount } from "@/lib/auth/session";
import { AccountLogin, EmailProof, ProfessionalProfile, TelegramAccountEntry, TelegramLink, TelegramConnect } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { TrialReturnLink } from "@/components/trial-return-link";
export const metadata={title:"Your account — SiteLedger AI",robots:{index:false,follow:false}};
async function AccountContent() {
  const account = await currentAccount(), siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  if (!account) return <><TelegramAccountEntry /><div className="account-columns"><AccountLogin siteKey={siteKey}/><aside className="account-aside"><h2>One account for your site work.</h2><p>Sign in with your email, or create an account and confirm its email code. Use the same account when connecting Telegram.</p><p>Your professional name appears on future records. Projects and site files stay private to authorized people.</p><Link href="/help" className="text-link mt-5">Read the account guide</Link><br/><Link href="/reports/demo" className="text-link">Explore a sample report</Link></aside></div></>;
  return <><TelegramConnect account={account} siteKey={siteKey} /><div className="account-columns"><div><p className="mt-5 leading-7">{account.professional_name ?? "Confirm your professional name to begin."}</p><ProfessionalProfile account={account} />
    {account.name_confirmed_at && <Link href="/projects" className="inline-flex min-h-12 items-center border border-ink px-5 py-3">Open your projects</Link>}
    </div><div>{account.source === "telegram" ? <AccountLogin siteKey={siteKey} telegramAccount={account} /> : <><EmailProof siteKey={siteKey} account={account} /><TelegramLink siteKey={siteKey} account={account} /></>}</div></div>
  </>;
}
export default function AccountPage() {
  return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="account" title="Your account"/><Suspense fallback={null}><TrialReturnLink/></Suspense><Suspense fallback={<p className="my-7" role="status">Opening your account…</p>}><AccountContent /></Suspense></main>;
}
