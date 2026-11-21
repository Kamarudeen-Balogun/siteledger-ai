import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getReview } from "@/lib/confirm/data";
import { ConfirmForm } from "@/components/confirm-form";
import { after } from "next/server";
import { processSubmissionPhotos } from "@/lib/ai/process-photos";
import { processSubmission } from "@/lib/ai/process-submission";

export const maxDuration = 120;

export const metadata: Metadata = { title: "Review site note — SiteLedger", referrer: "no-referrer", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ access?: string }> };
function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="mx-auto max-w-3xl px-5 py-10"><p className="font-mono text-sm">SITELEDGER / SITE DIARY</p>
    <h1 className="mt-6 font-serif text-3xl">{title}</h1><div className="mt-5 text-base leading-7">{children}</div></main>;
}
async function Review(props: Props) {
  await connection();
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const record = await getReview(id, typeof query.access === "string" ? query.access : "").catch(() => undefined);
  if (record === undefined) return <Message title="Your site note is saved">We couldn’t load it just now. Reopen your review button to try again.</Message>;
  if (!record) return <Message title="Open your private review button">Use “Review site note” in your Telegram chat with SiteLedger. If the link expired, send /today for a fresh button.</Message>;
  const voicePending=["queued","processing"].includes(record.job_status??"");
  if (record.pending_photo_analysis||voicePending) after(async()=>{await Promise.all([
    record.pending_photo_analysis?processSubmissionPhotos(record.id):undefined,
    voicePending?processSubmission(record.id):undefined,
  ]);});
  // Start editable fields from the completed extraction after a listening refresh.
  // Photo-only refreshes retain the form so they cannot discard someone's edits.
  return <ConfirmForm key={`${record.id}:${record.job_status}`} record={record} access={query.access!} />;
}
export default function Page(props: Props) {
  return <Suspense fallback={<Message title="Opening your site note…">Loading your voice note and photos.</Message>}><Review {...props} /></Suspense>;
}
