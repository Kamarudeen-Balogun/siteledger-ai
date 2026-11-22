import { displayDate, displayTimestamp } from "@/lib/reports/model";
import Link from "next/link";
import { formatMoney } from "@/lib/costing/format-money";
import type { DisputeLog } from "@/lib/log/data";
export function DisputeLogDocument({ log }: { log: DisputeLog }) {
  return <section aria-label="Dispute log"><p className="font-mono text-xs uppercase tracking-widest">Append-only site records</p>
    <h1 className="mt-3 font-serif text-3xl">Dispute log</h1><p className="mt-3">{log.project.name}</p>
    <p className="mt-3">Newest records first. Original entries cannot be changed or deleted.</p>
    {log.is_demo && <p className="mt-4 border-l-4 border-accent pl-4">Fictional demo history and illustrative NGN rates.</p>}
    {!log.entries.length ? <p className="mt-8 border-t border-rule py-6">No locked records yet. A project manager must approve a confirmed report first.</p>
      : <ol className="mt-7 border-t border-rule">{log.entries.toReversed().map(entry => <li key={entry.id} className="border-b border-rule py-5">
        <p className="font-mono text-sm"><time dateTime={entry.timestamp}>{displayTimestamp(entry.timestamp, entry.timezone)}</time> · {entry.kind === "report" ? "LOCKED REPORT" : "AMENDMENT"}</p>
        <p className="mt-2 font-semibold">{entry.author}</p>
        {entry.kind === "report" ? <p className="mt-2">{displayDate(entry.date)} · {formatMoney(entry.total_cost!, entry.currency ?? "NGN")} <span className="text-sm">{entry.currency}</span></p>
          : <p className="mt-3 whitespace-pre-wrap break-words">{entry.note}</p>}
        <p className="mt-3 break-all font-mono text-xs">{entry.kind === "amendment" ? `Amendment ${entry.id} · Original report ` : "Report "}{entry.report_id}</p>
        {entry.href && <Link prefetch={false} href={entry.href} className="mt-2 inline-block min-h-12 py-3 underline">{entry.kind === "amendment" ? "Open original report" : "Open locked report"}</Link>}
      </li>)}</ol>}
  </section>;
}
