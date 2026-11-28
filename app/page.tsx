import Link from "next/link";
import { PublicSite } from "@/components/public-site";
import { LandingAccountLink } from "@/components/landing-account-link";
import { DiaryIcon } from "@/components/diary-icon";
export const metadata={title:"SiteLedger AI — From site voice note to costed record",description:"Record site work by voice, confirm the quantities, cost them against your BoQ and preserve an approved report with photos and amendments."};
export default function Home() {
  return <PublicSite current="/">
    <div className="public-column flex flex-col pb-12">
      {/* Stitch's landing hero is a 12-column grid: headline + CTAs
          left (6), the sample-record preview card right (6). On
          mobile the wrapper is a plain block, so the two sections
          stack exactly as before. */}
      <div className="landing-hero-grid">
      <section className="flex flex-col gap-2 pt-4" aria-labelledby="hero-title">
        <h1 id="hero-title" className="mt-2 font-headline-lg-mobile text-headline-lg-mobile font-semibold tracking-tight text-balance text-on-surface">The day’s work. With the money attached.</h1>
        <p className="font-body-md text-body-md leading-relaxed text-on-surface-variant">Turn a foreman’s voice note and photos into a daily report, costed against the Bill of Quantities. Check the quantities. Approve the record. Keep the proof.</p>
        <div className="landing-hero-actions flex flex-col gap-2 pt-2">
          <LandingAccountLink trial className="flex h-12 w-full items-center justify-center gap-1 rounded bg-primary-container px-4 font-label-ledger text-label-ledger text-on-primary shadow-sm transition-all hover:bg-primary active:translate-x-0.5 active:translate-y-0.5" anonymousLabel="Try a private site record" />
          <LandingAccountLink className="flex h-12 w-full items-center justify-center rounded bg-surface-container-high px-4 font-label-ledger text-label-ledger text-on-surface transition-all hover:bg-surface-container-highest active:translate-x-0.5 active:translate-y-0.5" anonymousLabel="Sign in / Create account" />
          <Link href="/reports/demo" className="flex min-h-[48px] items-center justify-center gap-1 py-1 text-center font-label-ledger text-label-ledger text-primary transition-transform hover:text-primary-container active:scale-95">View a sample report<DiaryIcon name="chevron" size={18} /></Link>
        </div>
      </section>

      <section className="mt-6 flex flex-col" aria-labelledby="sample-record-title">
        <div className="relative flex flex-col gap-2 overflow-hidden rounded-xl bg-surface-container-lowest p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-stamp-label text-stamp-label uppercase text-on-surface-variant">Sample record</span>
            <span className="rotate-[-4deg] select-none rounded bg-primary-fixed/60 px-2 py-0.5 font-stamp-label text-[10px] font-bold uppercase leading-tight tracking-widest text-primary-container">Locked · 6 Nov 2026</span>
          </div>
          <h2 id="sample-record-title" className="font-headline-sm text-headline-sm text-on-surface">A real costed day, locked.</h2>
          {/* Compact code-built duplicate of the locked sample report at
              /reports/demo — the figures are the real sample's (seven BoQ
              items totalling ₦1,495,300, locked 6 Nov 2026). No screenshot:
              a code card cannot fail to load. Only the first item shows
              here; the full report is one tap away. */}
          <Link href="/reports/demo" aria-label="Open the sample report — locked 6 November 2026" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">Sample Report</span>
              <span className="inline-flex items-center gap-1 rounded bg-surface-container px-2 py-1"><span className="h-1.5 w-1.5 rounded-full bg-primary" /><span className="font-stamp-label text-stamp-label uppercase text-primary">Sample</span></span>
              <span className="inline-flex items-center gap-1 rounded bg-secondary-container px-2 py-1 text-on-secondary-container"><DiaryIcon name="lock" size={14} /><span className="font-stamp-label text-stamp-label uppercase">Locked</span></span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4 shadow-sm">
              <span className="font-stamp-label text-stamp-label uppercase text-on-surface-variant">Daily site report · 6 Nov 2026</span>
              <span className="mt-0.5 font-headline-md text-headline-md font-semibold text-on-surface">4-Bedroom Duplex, Lekki Phase 1, Lagos</span>
              <span className="font-body-md text-body-md text-on-surface-variant">Perkins Limited</span>
            </div>
            <div className="overflow-hidden rounded-xl bg-surface-container p-0 shadow-sm">
              <div className="flex justify-between px-4 pb-1 pt-3"><span className="font-stamp-label text-stamp-label uppercase text-on-surface-variant">Item</span><span className="font-stamp-label text-stamp-label uppercase text-on-surface-variant">Qty × Rate · Amount</span></div>
              <div className="flex flex-col px-2 pb-2">
                <div className="flex items-center justify-between rounded bg-surface-container-low px-2 py-3">
                  <div className="min-w-0 pr-2"><span className="block font-label-ledger text-label-ledger text-on-surface">Excavation, foundation trenches</span></div>
                  <div className="shrink-0 text-right"><span className="block font-code-entry text-code-entry text-on-surface-variant">27 m³ × ₦8,500</span><span className="block font-code-entry text-code-entry font-bold text-on-surface">₦229,500</span></div>
                </div>
                <div className="mx-2 mb-2 mt-1 flex items-center justify-between rounded bg-primary-fixed/40 px-2 py-2">
                  <span className="flex items-center gap-1.5"><DiaryIcon name="seal" size={18} /><span className="font-label-ledger text-label-ledger uppercase text-on-primary-fixed">Value of work today</span></span>
                  <span className="font-headline-sm text-headline-sm font-bold text-primary">₦1,495,300</span>
                </div>
              </div>
            </div>
          </Link>
          <p className="font-body-sm text-body-sm text-on-surface-variant">A locked daily record from the public demonstration — quantities checked, costed against the BoQ, and approved. <Link href="/reports/demo" className="text-link">See the full sample report</Link></p>
          <div className="flex items-start gap-2 pt-1">
            <DiaryIcon name="history" size={16} />
            <p className="font-body-sm text-body-sm text-on-surface-variant"><strong className="font-medium text-on-surface">Immutable audit trail:</strong> Voice note → human check → BoQ cost. Approval is locked; adjustments post as signed amendments.</p>
          </div>
        </div>
      </section>
      </div>

      <section className="landing-principles mt-6 flex flex-col gap-2" aria-labelledby="principles-title">
        <div className="flex items-center justify-between">
          <span className="font-stamp-label text-stamp-label uppercase text-on-surface-variant">Core Ledger Principles</span>
          <span className="font-stamp-label text-stamp-label font-semibold uppercase text-secondary">Field Tested</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="font-stamp-label text-stamp-label font-bold text-primary">01 / Money</span><DiaryIcon name="boq" size={20} /></div>
          <h3 id="principles-title" className="font-headline-sm text-headline-sm font-semibold text-on-surface">Cost the work against your BoQ.</h3>
          <p className="mt-0.5 font-body-md text-body-md text-on-surface-variant">Quantities link directly to contract rates so the day’s production reflects exact project liability, avoiding surprise variances at billing.</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="font-stamp-label text-stamp-label font-bold text-primary">02 / Proof</span><DiaryIcon name="camera" size={20} /></div>
          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Keep quantities, photos, and approvals together.</h3>
          <p className="mt-0.5 font-body-md text-body-md text-on-surface-variant">No chasing disconnected WhatsApp pictures or wet notebooks. Site visual evidence stays permanently anchored to line items and sign-offs.</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="font-stamp-label text-stamp-label font-bold text-primary">03 / Site fit</span><DiaryIcon name="send" size={20} /></div>
          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Speak in chat. Queue web notes offline.</h3>
          <p className="mt-0.5 font-body-md text-body-md text-on-surface-variant">Designed for spotty mobile data. Foremen simply drop a voice note or queue drafting offline; sync happens automatically when reconnected.</p>
        </div>
      </section>

      <section className="mt-6 flex flex-col" aria-labelledby="workflow-title">
        <div className="mb-2">
          <span className="font-stamp-label text-stamp-label uppercase text-primary">The Site Routine</span>
          <h2 id="workflow-title" className="mt-0.5 font-headline-lg-mobile text-headline-lg-mobile font-semibold text-on-surface">How a day gets recorded</h2>
        </div>
        <div className="workflow-list flex flex-col gap-2">
          {([
            ["01", "mic", "Send what happened", "Foreman records a 60-second voice note and uploads 4 site snapshots in Telegram or the mobile diary browser."],
            ["02", "check", "Check the quantities", "AI transcribes audio and extracts crew tallies & measurements. Human review inspects photo findings before anything touches cost."],
            ["03", "boq", "Cost and review", "Reconciled physical measurements compute against master BoQ rates in Naira. A comprehensive daily summary sheet is assembled."],
            ["04", "verified", "Approve and preserve", "PM issues digital stamp. The daily entry locks permanently against tampering; any future adjustments append as traceable amendments."],
          ] as const).map(([step, icon, title, text]) => <div key={step} className="flex items-start gap-2 rounded-xl bg-surface-container-low p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary-container/10"><span className="font-stamp-label text-label-ledger font-bold text-primary">{step}</span></div>
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-1.5"><DiaryIcon name={icon} size={18} /><h3 className="font-label-ledger text-label-ledger font-semibold text-on-surface">{title}</h3></div>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{text}</p>
            </div>
          </div>)}
        </div>
      </section>

      <section className="mt-6 flex flex-col gap-2" aria-labelledby="legal-title">
        <div className="landing-legal-card flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-4 shadow-md">
          <div className="flex flex-col">
            <span className="font-stamp-label text-stamp-label font-bold uppercase text-secondary">Legal clarity</span>
            <h2 id="legal-title" className="mt-0.5 font-headline-lg-mobile text-headline-lg-mobile font-semibold text-on-surface">Built for the questions that come later.</h2>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">When billings are queried weeks down the road, clear forensic proof ends disputes before they stall the project.</p>
          <div className="landing-legal-items flex flex-col gap-2 pt-1">
            {([
              ["Registered Professional Names & Roles", "Clear attribution for who logged, who reviewed, and who approved."],
              ["Dismissible Photo Findings", "Flag defects, weather interruptions, or low delivery supplies transparently."],
              ["Locked Originals with Linked Amendments", "Historical daily log state is non-destructive and auditable."],
              ["Private, Encrypted Site Repositories", "Strict tenant isolation protects commercial rates and client confidentiality."],
            ] as const).map(([title, text]) => <div key={title} className="flex items-start gap-2">
              <DiaryIcon name="seal" size={20} />
              <div className="flex flex-col"><span className="font-label-ledger text-label-ledger text-on-surface">{title}</span><span className="font-body-sm text-body-sm text-on-surface-variant">{text}</span></div>
            </div>)}
          </div>
          <div className="pt-1">
            <Link href="/log/demo" className="inline-flex min-h-[44px] items-center gap-1 font-label-ledger text-label-ledger text-primary transition-transform hover:text-primary-container active:scale-95">Explore the public dispute log<DiaryIcon name="chevron" size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="landing-roles mt-6 flex flex-col gap-2" aria-labelledby="roles-title">
        <div className="flex flex-col">
          <span className="font-stamp-label text-stamp-label uppercase text-on-surface-variant">Roles &amp; access</span>
          <h2 id="roles-title" className="mt-0.5 font-headline-lg-mobile text-headline-lg-mobile font-semibold text-on-surface">Structured for the entire project team</h2>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary-fixed text-on-primary-fixed"><DiaryIcon name="team" size={18} /></div>
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Foremen &amp; Site Engineers</h3>
          </div>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Frictionless field voice &amp; image logging. No heavy dashboards to navigate in dust and glare. Just quick voice notes, delivery photos, and back to work.</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-secondary-fixed text-on-secondary-fixed"><DiaryIcon name="progress" size={18} /></div>
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">PMs &amp; Quantity Surveyors</h3>
          </div>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Review reconciled quantities on an expanded ledger console, cross-examine unit rates against BoQ schedules, and release deliberate approval seals.</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-surface-container-high text-on-surface"><DiaryIcon name="review" size={18} /></div>
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Clients &amp; Consultants</h3>
          </div>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Receive crisp, client-ready PDF summaries complete with itemized Naira valuations and engineer stamps—no complex platform logins required.</p>
        </div>
      </section>

      <section className="mt-6 flex flex-col" aria-labelledby="sample-title">
        <div className="flex flex-col gap-3 rounded-xl bg-primary p-6 text-on-primary shadow-lg">
          <div className="flex flex-col gap-1">
            <span className="font-stamp-label text-stamp-label uppercase tracking-wider text-primary-fixed">Verifiable digital diary</span>
            <h2 id="sample-title" className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-primary">See what a costed day looks like.</h2>
            <p className="mt-1 font-body-md text-body-md text-on-primary/90">Inspect an authentic demonstration report with real sandcrete rates, concrete pours, photographic audit tags, and PM sign-off.</p>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <Link href="/reports/demo" className="flex h-12 w-full items-center justify-center gap-1 rounded bg-surface px-4 font-label-ledger text-label-ledger text-on-surface transition-all hover:bg-surface-container active:scale-95"><DiaryIcon name="reports" size={18} />Open the sample report</Link>
            <LandingAccountLink trial className="flex h-12 w-full items-center justify-center rounded bg-transparent px-4 font-label-ledger text-label-ledger text-on-primary transition-all hover:bg-on-primary/10 active:scale-95" anonymousLabel="Start free site trial" />
          </div>
        </div>
      </section>
    </div>
  </PublicSite>;
}
