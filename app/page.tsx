import Link from "next/link";
export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-6 sm:px-10">
      <header className="flex items-center gap-4 border-b border-rule py-7">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center border border-accent font-mono text-lg font-semibold text-accent"
        >
          SL
        </span>
        <div>
          <h1 className="font-serif text-2xl font-semibold">SiteLedger AI</h1>
          <p className="mt-1 text-sm">Daily site records, costed in naira.</p>
        </div>
      </header>

      <section aria-labelledby="diary-heading" className="flex-1 py-14 sm:py-20">
        <p className="font-mono text-xs uppercase tracking-widest">Site diary</p>
        <h2
          id="diary-heading"
          className="mt-5 max-w-xl font-serif text-4xl leading-tight sm:text-5xl"
        >
          Daily site records.
        </h2>
        <p className="mt-5 max-w-lg text-base leading-7">
          Your diary will hold the day’s work, confirmed quantities, and costs
          against the Bill of Quantities.
        </p>
        <Link href="/reports/demo" className="mt-6 inline-flex min-h-12 items-center bg-accent px-5 py-3 font-semibold text-white">Open demo daily report</Link>
        <Link href="/today" className="mt-4 flex min-h-12 items-center underline">Open your web site diary</Link>
      </section>

      <footer className="border-t border-rule py-5 font-mono text-xs leading-6">
        SiteLedger AI · Site records · Quantities · Costs
      </footer>
    </main>
  );
}
