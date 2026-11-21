import Link from "next/link";
export function StatusPage({ code, title, description, retry }: { code: string; title: string; description: string; retry?: () => void }) {
  return <main className="mx-auto flex min-h-[80svh] max-w-5xl flex-col px-5 py-7 sm:px-10">
    <header className="flex items-center gap-4 border-b border-rule pb-6"><Link href="/" className="flex size-12 items-center justify-center border border-accent font-mono font-semibold text-accent" aria-label="SiteLedger home">SL</Link>
      <p className="font-mono text-xs uppercase tracking-widest">SiteLedger / Site diary</p></header>
    <section className="grid flex-1 items-center gap-6 py-12 sm:grid-cols-[.7fr_1.3fr] sm:gap-14 sm:py-20">
      <div aria-hidden="true" className="border-l-4 border-accent pl-5"><p className="font-serif text-[clamp(5rem,17vw,10rem)] leading-none text-accent">{code}</p><p className="mt-4 font-mono text-xs uppercase tracking-widest">Page unavailable</p></div>
      <div><h1 className="max-w-lg font-serif text-4xl leading-tight sm:text-5xl">{title}</h1><p className="mt-5 max-w-lg text-base leading-7">{description}</p>
        <div className="mt-7 flex flex-wrap gap-3">{retry && <button type="button" onClick={retry} className="min-h-12 bg-accent px-5 py-3 font-semibold text-white">Try again</button>}
          <Link href="/projects" className={`inline-flex min-h-12 items-center px-5 py-3 ${retry ? "border border-ink" : "bg-accent font-semibold text-white"}`}>Open your projects</Link>
          <Link href="/account" className="inline-flex min-h-12 items-center px-3 py-3 underline">Your account</Link></div>
        <Link href="/" className="mt-5 inline-flex min-h-12 items-center underline">Back to SiteLedger</Link>
      </div>
    </section>
  </main>;
}
