import { PageLoading } from "@/components/page-loading";

// Shown immediately on a page change, before the destination page's own
// loading state takes over. Neutral diary shape — a header bar and ruled
// rows on paper — so navigation never flashes blank. It spans the
// workspace width (max-w-7xl, the widest workspace page): at 5xl it
// read as a narrow block on a wide desktop, not the full page.
export default function Loading() {
  return <main className="mx-auto min-h-svh max-w-7xl px-5 py-7 sm:px-10">
    <PageLoading
      title="Opening SiteLedger…"
      variant="rows"
      header={<div className="diary-skeleton__nav" aria-hidden="true"><i style={{ width: 120, height: 18 }} /><i style={{ width: 44, height: 18 }} /></div>}
    />
  </main>;
}
