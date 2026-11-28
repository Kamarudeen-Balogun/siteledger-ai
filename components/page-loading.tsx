import type { ReactNode } from "react";

// The loading state shown while a page change resolves. It reads as the
// diary turning a page: a subtle orange line at the top and ruled-paper
// skeleton rows shaped like the destination, on the same paper background.
// No big "Opening…" notice — the skeleton itself is the loading state, so a
// page change never flashes blank and never shifts layout when the real
// content lands. The title stays only as a small status line (and the
// accessible status). All motion is the existing shimmer, which the
// reduced-motion rule already disables.
export type PageLoadingVariant = "rows" | "report" | "form" | "table" | "split";
// The two-column pages' splits, matching the desktop layer's
// 12-column grid (Today 6+6, Team 8+4, Account and Project
// detail 5+7). The skeleton takes the destination page's shape,
// so a reload reads as the page it is loading, not a generic
// single-column stack of rows.
export type PageLoadingSplit = "6-6" | "8-4" | "5-7";

function Entry({ widths }: { widths: string[] }) {
  return <div className="diary-skeleton__entry" aria-hidden="true">
    {widths.map((width, index) => <i key={index} style={{ width }} />)}
  </div>;
}

// How many ruled entries each skeleton column carries, mirroring
// the real page's blocks: Today left has Awaiting review,
// Today's submissions and the Daily ledger entry (3) with Work
// Progress and the Telegram example right (2); Team left is the
// long members list (3) with overview, Reports & Log and Telegram
// right (3); Account / Project detail are two cards a side (2, 2).
const splitColumns: Record<PageLoadingSplit, [number, number]> = {
  "6-6": [3, 2],
  "8-4": [3, 3],
  "5-7": [2, 2],
};

function SplitColumn({ entries }: { entries: number }) {
  const patterns = [
    ["96px", "62%", "88%"],
    ["96px", "54%", "76%"],
    ["96px", "66%", "84%"],
  ];
  return <div className="diary-skeleton__column" aria-hidden="true">
    {Array.from({ length: entries }, (_, index) => <Entry key={index} widths={patterns[index % patterns.length]} />)}
  </div>;
}

export function PageLoading({ title, detail, variant = "rows", split = "6-6", header }: {
  title: string; detail?: string; variant?: PageLoadingVariant; split?: PageLoadingSplit; header?: ReactNode;
}) {
  return <>
    {header}
    <div className="diary-loading-top" aria-hidden="true"><i /></div>
    <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant" role="status">{title}{detail ? ` — ${detail}` : ""}</p>
    {/* The tall skeleton bars first: on a tab change the loader must read
      as a skeleton at once, not as a heading over blank paper — the audit
      saw only the heading, and these are the bars a project switch
      already shows. The shaped diary rows follow below them. */}
    <div className="stitch-skeleton-stack" aria-hidden="true"><i /><i /><i /></div>
    <div className={`diary-skeleton diary-skeleton--${variant}`} data-split={split} aria-hidden="true">
      {variant === "report" && <div className="diary-skeleton__total"><i style={{ width: "38%" }} /><i style={{ width: "28%", height: 24 }} /></div>}
      {variant === "split"
        ? <><SplitColumn entries={splitColumns[split][0]} /><SplitColumn entries={splitColumns[split][1]} /></>
        : variant === "form"
        ? <><Entry widths={["96px", "100%"]} /><Entry widths={["96px", "100%"]} /><Entry widths={["96px", "100%"]} /></>
        : variant === "table"
          ? <><Entry widths={["42%", "88%", "64%"]} /><Entry widths={["38%", "82%", "58%"]} /><Entry widths={["46%", "86%", "60%"]} /></>
          : <><Entry widths={["96px", "62%", "88%"]} /><Entry widths={["96px", "54%", "76%"]} /><Entry widths={["96px", "66%", "84%"]} /></>}
    </div>
  </>;
}
