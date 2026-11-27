import Link from "next/link";
import { PublicSite } from "@/components/public-site";
import { LandingAccountLink } from "@/components/landing-account-link";
import { DiaryIcon } from "@/components/diary-icon";
export const metadata={title:"SiteLedger AI — From site voice note to costed record",description:"Record site work by voice, confirm the quantities, cost them against your BoQ and preserve an approved report with photos and amendments."};
export default function Home() {
  return <PublicSite current="/">
    <div className="content-width stitch-landing">
      <section className="stitch-card stitch-landing-hero" aria-labelledby="hero-title">
        <p className="stitch-kicker" data-ink="orange">Digital Site Diary</p>
        <h1 id="hero-title">The day’s work.<br/><span>With the money attached.</span></h1>
        <p>Turn a foreman’s voice note and photos into a daily report, costed against the Bill of Quantities. Check the quantities. Approve the record. Keep the proof.</p>
        <div className="stitch-menu-list">
          <LandingAccountLink trial className="stitch-button stitch-landing-primary" anonymousLabel="Try a private site record"/>
          <LandingAccountLink className="stitch-button" anonymousLabel="Sign in / Create account"/>
          <Link href="/reports/demo" className="stitch-button"><DiaryIcon name="reports" size={18}/>View a sample report</Link>
        </div>
      </section>
      <section className="demo-ledger" aria-labelledby="sample-record-title">
        <div className="stitch-title-row"><h2 id="sample-record-title" className="stitch-kicker">Sample record</h2><span className="sample-stamp">Illustrative daily record</span></div>
        <p className="mt-3 leading-7">Lekki duplex — confirmed site quantities, reconciled against the Bill of Quantities (demo).</p>
        <table className="sample-table"><thead><tr><th>Item / Scope</th><th>Qty</th><th>Amount</th></tr></thead><tbody>
          <tr><th>Blockwork · East elevation<br/><span className="font-normal">9-inch hollow sandcrete</span></th><td>18 m²</td><td>₦261,000</td></tr>
          <tr><th>Concrete · Beams / Columns<br/><span className="font-normal">Grade 25 structural pour</span></th><td>2 m³</td><td>₦290,000</td></tr>
        </tbody></table>
        <div className="sample-total"><span>Daily value</span><strong>₦551,000</strong></div>
        <p className="mt-4 leading-7">Voice note → human check → BoQ cost. Approval is locked; adjustments post as signed amendments.</p>
        <div className="stitch-menu-list mt-4">
          <Link href="/reports/demo" className="stitch-button" data-primary><DiaryIcon name="reports" size={18}/>Open the sample report</Link>
          <Link href="/log/demo" className="stitch-button"><DiaryIcon name="lock" size={18}/>Explore the public dispute log</Link>
        </div>
      </section>
      <section className="landing-principles" aria-labelledby="principles-title">
        <div className="section-heading"><p className="eyebrow">Field tested</p><h2 id="principles-title" className="section-title">Core Ledger Principles</h2></div>
        <div><span className="eyebrow">01 / Money</span><h3 className="font-serif text-2xl">Cost the work against your BoQ.</h3><p className="mt-2 leading-7">Quantities link directly to contract rates so the day’s production reflects exact project liability, avoiding surprise variances at billing.</p></div>
        <div><span className="eyebrow">02 / Proof</span><h3 className="font-serif text-2xl">Keep quantities, photos, and approvals together.</h3><p className="mt-2 leading-7">No chasing disconnected chat pictures or wet notebooks. Site evidence stays anchored to line items and sign-offs.</p></div>
        <div><span className="eyebrow">03 / Site fit</span><h3 className="font-serif text-2xl">Speak in chat. Queue web notes offline.</h3><p className="mt-2 leading-7">Designed for spotty Lagos and Abuja mobile data. Foremen drop a voice note or queue drafting offline; sync happens automatically when reconnected.</p></div>
      </section>
      <section id="how-it-works" aria-labelledby="workflow-title">
        <h2 id="workflow-title" className="stitch-section-title">How it works</h2>
        <ol className="stitch-menu-list">{([
          ["mic","Send what happened","Record a voice note, attach site photos, or do both. Use Telegram or the web diary. Web notes can wait on your device until data returns."],
          ["review","Check the quantities","Review the transcript, work items, crew and possible photo findings. Correct unclear values before costing."],
          ["boq","Cost and review","Confirmed quantities meet your supplied BoQ rates. Open the daily report and download its client-ready PDF."],
          ["lock","Approve and preserve","A PM approves the draft in a separate action. The locked original stays intact. Later corrections become linked amendments."],
        ] as const).map(([icon,title,description])=><li key={title} className="stitch-menu-row"><DiaryIcon name={icon}/><span><strong>{title}</strong><small>{description}</small></span></li>)}</ol>
      </section>
      <section className="landing-section" aria-labelledby="legal-title">
        <div className="section-heading"><p className="eyebrow">Legal clarity</p><h2 id="legal-title">Built for the questions that come later.</h2><p>When billings are queried weeks down the road, clear proof ends disputes before they stall the project.</p></div>
        <ul className="ruled-points">
          <li><strong>Registered professional names &amp; roles</strong> — clear attribution for who logged, who reviewed, and who approved.</li>
          <li><strong>Dismissible photo findings</strong> — flag defects, weather interruptions, or low delivery supplies transparently.</li>
          <li><strong>Locked originals with linked amendments</strong> — the daily log is append-only and auditable. Your reports are locked once approved.</li>
          <li><strong>Private site repositories</strong> — strict project isolation protects commercial rates and client confidentiality.</li>
        </ul>
      </section>
      <section className="audience-section" aria-labelledby="roles-title">
        <div className="section-heading"><p className="eyebrow">Roles &amp; access</p><h2 id="roles-title">Structured for the entire project team</h2></div>
        <div className="audience-columns">
          <div><h3>Foremen &amp; Site Engineers</h3><p>Frictionless field voice and image logging. No heavy dashboards to navigate in dust and glare. Just quick voice notes, delivery photos, and back to work.</p></div>
          <div><h3>PMs &amp; Quantity Surveyors</h3><p>Review reconciled quantities, check unit rates against BoQ schedules, and approve reports.</p></div>
          <div><h3>Clients &amp; Consultants</h3><p>Receive crisp, client-ready PDF summaries complete with itemized naira valuations — no complex platform logins required.</p></div>
        </div>
      </section>
      <section id="about" className="stitch-card" aria-labelledby="about-title">
        <h2 id="about-title">About SiteLedger</h2>
        <p>A voice note tells you what happened. A costed, confirmed record helps explain what that work means for the project.</p>
        <h3>From verbal updates to dated proof</h3>
        <p>A foreman’s update, a phone gallery and a price list often live in separate places. SiteLedger brings them into a daily report: work items, quantities, supplied rates, photos and the people who confirmed and approved it.</p>
        <p>The Nigerian demonstration uses naira, Nigerian English and Pidgin site terms. Private projects select their own currency and timezone; prices always come from that project’s BoQ.</p>
        <h3>The person stays in charge</h3>
        <p>AI transcribes and suggests structured work items and possible photo findings. A person checks the quantities and observations before costing. A PM then approves the report in a separate action, including on a one-person project.</p>
        <p>A locked original cannot be silently rewritten. A correction becomes an amendment with its own author and timestamp. Your reports are locked once approved.</p>
        <h3>About the builder</h3>
        <p>Built by Balogun Kamarudeen Ayomide — Civil Engineer &amp; AI Automation Specialist</p>
        <div className="flex flex-wrap gap-5"><a className="text-link" href="https://codeflowx.dev" target="_blank" rel="noreferrer">codeflowx.dev</a><a className="text-link" href="mailto:kamarudeen@codeflowx.dev">kamarudeen@codeflowx.dev</a><a className="text-link" href="https://github.com/Kamarudeen-Balogun/siteledger-ai" target="_blank" rel="noreferrer">GitHub</a><a className="text-link" href="https://t.me/SiteLedgerNGbot" target="_blank" rel="noreferrer">Telegram @SiteLedgerNGbot</a></div>
        <p className="mt-4">The public Lekki duplex and its client are fictional. Its rates are illustrative. Synthetic demonstration photos are labelled; the public sample never includes a user’s private uploads.</p>
      </section>
      <section className="stitch-card" aria-labelledby="sample-title">
        <h2 id="sample-title">See what a costed day looks like</h2>
        <p>Inspect a demonstration report with real sandcrete rates, concrete pours, and PM sign-off — the fictional Lekki duplex, exactly as a client would see it.</p>
        <div className="stitch-menu-list">
          <Link href="/reports/demo" className="stitch-button" data-primary><DiaryIcon name="reports" size={18}/>Open the sample report</Link>
          <Link href="/log/demo" className="stitch-button"><DiaryIcon name="lock" size={18}/>Open the sample dispute log</Link>
          <LandingAccountLink trial className="stitch-button" anonymousLabel="Start free site trial"/>
        </div>
      </section>
    </div>
  </PublicSite>;
}
