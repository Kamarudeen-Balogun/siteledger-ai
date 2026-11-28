import type { ReactNode } from "react";

// The loading state shown while a page change resolves. It reads as the
// diary turning a page: a subtle orange line at the top and ruled-paper
// skeleton rows shaped like the destination, on the same paper background.
// No big "Opening…" notice — the skeleton itself is the loading state, so a
// page change never flashes blank and never shifts layout when the real
// content lands. The title stays only as a small status line (and the
// accessible status). All motion is the existing shimmer, which the
// reduced-motion rule already disables.
export type PageLoadingVariant = "rows" | "report" | "form" | "table";

function Entry({ widths }: { widths: string[] }) {
  return <div className="diary-skeleton__entry" aria-hidden="true">
    {widths.map((width, index) => <i key={index} style={{ width }} />)}
  </div>;
}

export function PageLoading({ title, detail, variant = "rows", header }: {
  title: string; detail?: string; variant?: PageLoadingVariant; header?: ReactNode;
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
    <div className={`diary-skeleton diary-skeleton--${variant}`} aria-hidden="true">
      {variant === "report" && <div className="diary-skeleton__total"><i style={{ width: "38%" }} /><i style={{ width: "28%", height: 24 }} /></div>}
      {variant === "form"
        ? <><Entry widths={["96px", "100%"]} /><Entry widths={["96px", "100%"]} /><Entry widths={["96px", "100%"]} /></>
        : variant === "table"
          ? <><Entry widths={["42%", "88%", "64%"]} /><Entry widths={["38%", "82%", "58%"]} /><Entry widths={["46%", "86%", "60%"]} /></>
          : <><Entry widths={["96px", "62%", "88%"]} /><Entry widths={["96px", "54%", "76%"]} /><Entry widths={["96px", "66%", "84%"]} /></>}
    </div>
  </>;
}
