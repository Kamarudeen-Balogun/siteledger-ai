import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { demoReport } from "@/lib/data/demo-documents";
import { PublicSite } from "@/components/public-site";
import { DiaryIcon } from "@/components/diary-icon";
import { displayUnit, displayWorkTitle, formatQuantity, displayDate } from "@/lib/reports/model";
import { pageMetadata } from "@/lib/seo";
const naira = new Intl.NumberFormat("en-NG");
function money(value: string) { return `₦${naira.format(Number(value))}`; }
const demoProjectName = demoReport.document.source.project.name;
const demoReportDate = displayDate(demoReport.document.source.date);
const demoTotal = money(demoReport.document.costing.total_cost);
const demoItemCount = demoReport.document.costing.items.length;
export const metadata: Metadata = pageMetadata({
  title: `Sample report: ${demoProjectName} — ${demoTotal} locked — SiteLedger AI`,
  description: `A locked daily site report from ${demoReportDate}: ${demoItemCount} BoQ items costed against the Bill of Quantities, totalling ${demoTotal}, signed by Musa Bello (Foreman) and Engr. Tola Adeyemi (PM). See what a costed day looks like.`,
  path: "/reports/demo",
  type: "article",
  publishedTime: "2026-11-06",
});
export default function Page() {
  const report = demoReport;
  const document = report.document;
  const source = document.source;
  const costing = document.costing;
  const rows = costing.items.map(item => {
    const found = source.items.find(entry => entry.boq_item_id === item.boq_item_id);
    const priced = source.price_list.find(entry => entry.id === item.boq_item_id);
    return { title: displayWorkTitle(priced?.description, found?.description ?? "Work item"), detail: "", qty: `${formatQuantity(item.quantity_done)} ${displayUnit(item.unit)}`, rate: money(item.rate), amount: money(item.cost_today) };
  });
  return <PublicSite current="/reports/demo">
    <div className="sample-report-layout public-column flex flex-col gap-3 pb-10 pt-4">
      <Link href="/" className="flex min-h-[44px] items-center gap-1 self-start font-label-ledger text-label-ledger text-primary"><DiaryIcon name="back" size={18} />Back to home</Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-semibold text-on-surface">Sample Report</h1>
        <span className="inline-flex items-center gap-1 rounded bg-surface-container px-2 py-1"><span className="h-1.5 w-1.5 rounded-full bg-primary" /><span className="font-stamp-label text-stamp-label uppercase text-primary">Sample</span></span>
        <span className="inline-flex items-center gap-1 rounded bg-secondary-container px-2 py-1 text-on-secondary-container"><DiaryIcon name="lock" size={14} /><span className="font-stamp-label text-stamp-label uppercase">Locked</span></span>
      </div>
      <div className="flex flex-col gap-1 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
        <span className="font-stamp-label text-stamp-label uppercase text-on-surface-variant">Daily site report · 6 Nov 2026</span>
        <h2 className="mt-0.5 font-headline-md text-headline-md font-semibold text-on-surface">{source.project.name}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Perkins Limited</p>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">This report started as a foreman’s voice note and site photos. A person checked the quantities, then each item was costed against the project’s Bill of Quantities.</p>
      </div>
      <div className="overflow-hidden rounded-xl bg-surface-container-lowest p-0 shadow-sm">
        <div className="flex justify-between px-4 pb-1 pt-3"><span className="font-stamp-label text-stamp-label uppercase text-on-surface-variant">Item</span><span className="font-stamp-label text-stamp-label uppercase text-on-surface-variant">Qty × Rate · Amount</span></div>
        <div className="flex flex-col px-2 pb-2">
          {rows.map(row => <div key={row.title} className="flex items-center justify-between rounded bg-surface-container-low px-2 py-3">
            <div className="min-w-0 pr-2"><span className="block font-label-ledger text-label-ledger text-on-surface">{row.title}</span>{row.detail && <span className="font-body-sm text-body-sm text-on-surface-variant">{row.detail}</span>}</div>
            <div className="shrink-0 text-right"><span className="block font-code-entry text-code-entry text-on-surface-variant">{row.qty} × {row.rate}</span><span className="block font-code-entry text-code-entry font-bold text-on-surface">{row.amount}</span></div>
          </div>)}
          <div className="mx-2 mb-2 mt-1 flex items-center justify-between rounded bg-primary-fixed/40 px-2 py-2">
            <span className="flex items-center gap-1.5"><DiaryIcon name="seal" size={18} /><span className="font-label-ledger text-label-ledger uppercase text-on-primary-fixed">Value of work today</span></span>
            <span className="font-headline-sm text-headline-sm font-bold text-primary">{money(costing.total_cost)}</span>
          </div>
        </div>
      </div>
      <figure className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        <Image src="/demo/photos/synthetic-column-voids.jpg" width={800} height={600} alt="Illustrative concrete column showing surface voids" className="h-auto w-full" />
        <figcaption className="p-4 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">Synthetic example · Possible honeycombing. Check the column face before recording a finding.</figcaption>
      </figure>
      <p className="font-body-sm text-body-sm text-on-surface-variant">Weather on the day: {document.weather}.</p>
      <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-4 shadow-sm">
        <span className="font-stamp-label text-stamp-label uppercase text-on-surface-variant">Signed</span>
        <div className="flex items-start gap-2">
          <DiaryIcon name="mic" size={20} />
          <div><span className="block font-label-ledger text-label-ledger text-on-surface">Recorded by Musa Bello</span><span className="font-body-sm text-body-sm text-on-surface-variant">Foreman · Voice note and photos, 6 Nov 2026</span></div>
        </div>
        <div className="flex items-start gap-2">
          <DiaryIcon name="verified" size={20} />
          <div><span className="block font-label-ledger text-label-ledger text-on-surface">Approved by Engr. Tola Adeyemi</span><span className="font-body-sm text-body-sm text-on-surface-variant">Project Manager · Checked and approved, 6 Nov 2026</span></div>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">This report is locked. It can’t be edited or deleted — if anything is wrong, a correction is added as a separate note linked to this report, so the full story stays visible.</p>
      </div>
      <a download href="/api/reports/demo/pdf" className="flex h-12 w-full items-center justify-center gap-2 rounded bg-primary-container px-4 font-label-ledger text-label-ledger text-on-primary shadow-sm transition-all hover:bg-primary active:scale-[0.99]"><DiaryIcon name="pdf" size={18} />Download PDF</a>
      <Link href="/trial" className="flex h-12 w-full items-center justify-center gap-2 rounded bg-surface-container-high px-4 font-label-ledger text-label-ledger text-on-surface transition-all hover:bg-surface-container-highest active:scale-[0.99]">Try it yourself — no account needed<DiaryIcon name="chevron" size={18} /></Link>
      <p className="font-body-sm text-body-sm text-on-surface-variant">Fictional seeded record · 6 November 2026 · <Link href="/log/demo" className="underline">Open the demo dispute log</Link></p>
    </div>
  </PublicSite>;
}
