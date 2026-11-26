import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getReview } from "@/lib/confirm/data";
import { ConfirmForm } from "@/components/confirm-form";
import { after } from "next/server";
import { processSubmissionPhotos } from "@/lib/ai/process-photos";
import { processSubmission } from "@/lib/ai/process-submission";
import Link from "next/link";
import { TelegramAccountEntry } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
import { currentSessionHash } from "@/lib/auth/session";
import { intakeRpc } from "@/lib/telegram/storage";
import type { ReviewDraft } from "@/lib/confirm/draft";

export const maxDuration = 300;

export const metadata: Metadata = { title: "Review site note — SiteLedger", referrer: "no-referrer", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ access?: string }> };
function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl px-5 py-7 sm:px-10"><WorkspaceHeader current="reports"/>
    <h1 className="mt-6 font-serif text-3xl">{title}</h1><div className="mt-5 text-base leading-7">{children}</div></main>;
}
async function Review(props: Props) {
  await connection();
  const { id } = await props.params;
  const record = await getReview(id).catch(() => undefined);
  if (record === undefined) return <Message title="Could not open this site note">We couldn’t load it just now. Reopen your review button to try again.</Message>;
  if (!record) return <Message title="Sign in to review your site note"><TelegramAccountEntry /><Link href="/account" className="inline-flex min-h-12 items-center underline">Open your account</Link><p>Project membership is required to open this record.</p></Message>;
  const voicePending=["queued","processing"].includes(record.job_status??"");
  if (record.pending_photo_analysis||voicePending) after(async()=>{await Promise.all([
    record.pending_photo_analysis?processSubmissionPhotos(record.id):undefined,
    voicePending?processSubmission(record.id):undefined,
  ]);});
  // Start editable fields from the completed extraction after a listening refresh.
  // Photo-only refreshes retain the form so they cannot discard someone's edits.
  const draft = record.status === "locked" ? null : await intakeRpc<{ draft: ReviewDraft | null } | null>("account_review_draft", { p_hash: await currentSessionHash(), p_id: id, p_payload: null }).catch(() => null);
  return <ConfirmForm key={`${record.id}:${record.job_status}`} record={record} draft={draft?.draft} />;
}
export default function Page(props: Props) {
  return <Suspense fallback={<main className="mx-auto max-w-5xl px-5 py-7 sm:px-10"><WorkspaceHeader current="reports"/><DiaryNotice busy title="Opening your site note…">Loading your voice note and photos.</DiaryNotice></main>}><Review {...props} /></Suspense>;
}
