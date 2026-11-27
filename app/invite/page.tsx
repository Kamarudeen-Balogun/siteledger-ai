import { Suspense } from "react";
import Link from "next/link";
import { currentAccount } from "@/lib/auth/session";
import { AccountLogin, EmailProof } from "@/components/account-forms";
import { InvitationAcceptance } from "@/components/project-forms";
import { PublicSite } from "@/components/public-site";
import { DiaryNotice } from "@/components/diary-notice";
export const metadata = { title: "Project invitation — SiteLedger", referrer: "no-referrer" as const, robots: { index: false, follow: false } };
async function Invitation() {
  const account = await currentAccount(), siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  if (!account || account.source === "telegram") return <><p className="my-5 font-body-md text-body-md leading-relaxed text-on-surface-variant">Sign in or create an account with the email this invitation was addressed to. Acceptance is a separate action after email verification.</p><AccountLogin siteKey={siteKey} telegramAccount={account ?? undefined} nextPath="/invite" /></>;
  return <><p className="my-5 font-body-md text-body-md leading-relaxed text-on-surface-variant">Signed in as {account.email}. The invitation grants only the role selected by its owner.</p><EmailProof siteKey={siteKey} account={account} />
    <InvitationAcceptance verified={account.email_verified} nameConfirmed={Boolean(account.name_confirmed_at)} /></>;
}
export default function InvitePage() {
  return <PublicSite current="/invite"><div className="public-column pb-10 pt-4"><Link href="/account" className="inline-flex min-h-12 items-center font-label-ledger text-label-ledger text-primary underline">Your account</Link><h1 className="mt-2 font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Accept a project invitation</h1><Suspense fallback={<DiaryNotice busy title="Opening your account…">Checking the session before invitation acceptance.</DiaryNotice>}><Invitation /></Suspense></div></PublicSite>;
}
