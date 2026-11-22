import { Suspense } from "react";
import Link from "next/link";
import { currentAccount } from "@/lib/auth/session";
import { AccountLogin, EmailProof } from "@/components/account-forms";
import { InvitationAcceptance } from "@/components/project-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
export const metadata = { title: "Project invitation — SiteLedger", referrer: "no-referrer" as const, robots: { index: false, follow: false } };
async function Invitation() {
  const account = await currentAccount(), siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  if (!account || account.source === "telegram") return <><p className="my-5 leading-7">Sign in or create an account with the email this invitation was addressed to. Acceptance is a separate action after email verification.</p><AccountLogin siteKey={siteKey} telegramAccount={account ?? undefined} nextPath="/invite" /></>;
  return <><p className="my-5 leading-7">Signed in as {account.email}. The invitation grants only the role selected by its owner.</p><EmailProof siteKey={siteKey} account={account} />
    <InvitationAcceptance verified={account.email_verified} nameConfirmed={Boolean(account.name_confirmed_at)} /></>;
}
export default function InvitePage() {
  return <main className="mx-auto min-h-screen max-w-5xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="projects"/><Link href="/account" className="inline-flex min-h-12 items-center underline">Your account</Link><h1 className="mt-5 font-serif text-3xl">Accept a project invitation</h1><Suspense fallback={<DiaryNotice busy title="Opening your account…">Checking the session before invitation acceptance.</DiaryNotice>}><Invitation /></Suspense></main>;
}
