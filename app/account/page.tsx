import { Suspense } from "react";
import Link from "next/link";
import { currentAccount } from "@/lib/auth/session";
import { AccountLogin, EmailProof, ProfessionalProfile, TelegramAccountEntry, TelegramLink, TelegramConnect } from "@/components/account-forms";
async function AccountContent() {
  const account = await currentAccount(), siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  if (!account) return <><TelegramAccountEntry /><AccountLogin siteKey={siteKey} /></>;
  return <><TelegramConnect account={account} siteKey={siteKey} /><p className="mt-5 leading-7">{account.professional_name ?? "Confirm your professional name to begin."}</p><ProfessionalProfile account={account} />
    {account.name_confirmed_at && <Link href="/projects" className="inline-flex min-h-12 items-center border border-ink px-5 py-3">Open your projects</Link>}
    {account.source === "telegram" ? <AccountLogin siteKey={siteKey} telegramAccount={account} /> : <><EmailProof siteKey={siteKey} account={account} /><TelegramLink siteKey={siteKey} account={account} /></>}
  </>;
}
export default function AccountPage() {
  return <main className="mx-auto min-h-screen max-w-3xl px-5 pb-16 pt-7"><header className="border-b border-rule pb-6"><Link href="/" className="inline-flex min-h-12 items-center font-mono text-sm tracking-wide">SITELEDGER / SITE DIARY</Link><h1 className="mt-5 font-serif text-3xl">Your account</h1></header><Suspense fallback={<p className="my-7" role="status">Opening your account…</p>}><AccountContent /></Suspense></main>;
}
