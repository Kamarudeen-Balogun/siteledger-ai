import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getDisputeLog } from "@/lib/log/data";
import { DisputeLogDocument } from "@/components/dispute-log";
import { TelegramAccountEntry } from "@/components/account-forms";
export const metadata: Metadata = { title: "Dispute log — SiteLedger", referrer: "no-referrer", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }> };
async function Log(props: Props) {
  await connection(); const { id } = await props.params;
  const result = await getDisputeLog(id).then(log => ({ log })).catch(() => null);
  if (!result) return <p>Could not open the log. Your records are preserved; reopen the link to try again.</p>;
  if (!result.log) return <><TelegramAccountEntry /><p>Sign in and open an authorized project to read its dispute log.</p><a className="inline-flex min-h-12 items-center underline" href="/account">Open your account</a></>;
  return <><a href={`/reports/${id}`} className="mb-4 inline-block min-h-12 py-3 underline">Back to report</a><DisputeLogDocument log={result.log} /></>;
}
export default function Page(props: Props) {
  return <main className="mx-auto max-w-4xl px-5 py-7 sm:px-8"><Suspense fallback={<p role="status">Opening the dispute log…</p>}><Log {...props} /></Suspense></main>;
}
