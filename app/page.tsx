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
        </div>
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
      <section className="stitch-card stitch-landing-evidence">
        <h2>Keep a record you can return to</h2>
        <ul>
          <li><DiaryIcon name="profile" size={18}/>Professional names and roles recorded at each action.</li>
          <li><DiaryIcon name="camera" size={18}/>Possible photo findings people can correct or dismiss.</li>
          <li><DiaryIcon name="history" size={18}/>Locked originals and a separate amendment history.</li>
          <li><DiaryIcon name="team" size={18}/>Private projects with owner-controlled access.</li>
        </ul>
      </section>
      <section className="stitch-card" aria-labelledby="sample-title">
        <h2 id="sample-title">See a sample</h2>
        <p>Open the fictional Lekki duplex demonstration — a locked daily report and its dispute log, exactly as a client would see them.</p>
        <div className="stitch-menu-list">
          <Link href="/reports/demo" className="stitch-button" data-primary><DiaryIcon name="reports" size={18}/>Open the sample report</Link>
          <Link href="/log/demo" className="stitch-button"><DiaryIcon name="lock" size={18}/>Open the sample dispute log</Link>
        </div>
      </section>
    </div>
  </PublicSite>;
}
