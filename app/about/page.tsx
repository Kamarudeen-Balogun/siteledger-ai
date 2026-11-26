import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { InformationPage } from "@/components/public-site";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryIcon } from "@/components/diary-icon";
import { currentAccount } from "@/lib/auth/session";
export const metadata={title:"About — SiteLedger AI",description:"Why SiteLedger connects daily site records, confirmed quantities and BoQ costing. Built by CodeFlowX and Kamarudeen Balogun."};
function PublicAbout(){return <InformationPage current="/about" label="The reason for the record" title="Site work deserves a clear account." intro={<p>A voice note tells you what happened. A costed, confirmed record helps explain what that work means for the project.</p>}>
  <section><h2>From verbal updates to dated proof</h2><p>A foreman’s update, a phone gallery and a price list often live in separate places. SiteLedger brings them into a daily report: work items, quantities, supplied rates, photos and the people who confirmed and approved it.</p><p>The Nigerian demonstration uses naira, Nigerian English and Pidgin site terms. Private projects select their own currency and timezone; prices always come from that project’s BoQ.</p></section>
  <section><h2>The person stays in charge</h2><p>AI transcribes and suggests structured work items and possible photo findings. A person checks the quantities and observations before costing. A PM then approves the report in a separate action, including on a one-person project.</p><p>A locked original cannot be silently rewritten. A correction becomes an amendment with its own author and timestamp.</p></section>
  <section><h2>About the builder</h2><p>Built by Balogun Kamarudeen Ayomide — Civil Engineer &amp; AI Automation Specialist</p><div className="flex flex-wrap gap-5"><a className="text-link" href="https://codeflowx.dev" target="_blank" rel="noreferrer">codeflowx.dev</a><a className="text-link" href="mailto:kamarudeen@codeflowx.dev">kamarudeen@codeflowx.dev</a><a className="text-link" href="https://github.com/Kamarudeen-Balogun/siteledger-ai" target="_blank" rel="noreferrer">GitHub</a></div></section>
  <section><h2>Explore the demonstration</h2><p>The public Lekki duplex and its client are fictional. Its rates are illustrative. Synthetic demonstration photos are labelled; the public sample never includes a user’s private uploads.</p><Link href="/reports/demo" className="public-button bg-accent font-semibold text-white">Open the sample report</Link></section>
  </InformationPage>;}

async function AboutContent(){
  if(!await currentAccount().catch(()=>null))return <PublicAbout/>;
  return <main className="mx-auto min-h-svh max-w-5xl px-5 py-7 stitch-about">
    <WorkspaceHeader current="account" title="About" hideProfile/>
    <section className="stitch-card"><div className="stitch-about-brand"><Image src="/stitch-siteledger-mark.png" alt="" width={40} height={40}/><div><h1>SiteLedger AI</h1><span className="stitch-kicker">Digital Site Diary</span></div></div>
      <p>SiteLedger AI turns voice notes and site photos into costed, locked daily reports using the project’s Bill of Quantities. Use the web diary or send your notes directly to @SiteLedgerNGbot. Corrections become amendments in the dispute log.</p>
      <p className="stitch-help-device"><DiaryIcon name="phone" size={18}/>Works on iPhone and Android.</p>
    </section>
    <section className="stitch-card"><span className="stitch-kicker">Built by</span><h2>Balogun Kamarudeen Ayomide</h2><p>Civil Engineer &amp; AI Automation Specialist</p>
      <div className="stitch-about-links"><a href="https://codeflowx.dev" target="_blank" rel="noreferrer">codeflowx.dev</a><a href="mailto:kamarudeen@codeflowx.dev">kamarudeen@codeflowx.dev</a><a href="https://github.com/Kamarudeen-Balogun/siteledger-ai">GitHub</a></div>
    </section>
  </main>;
}
export default function About(){
  return <Suspense fallback={null}><AboutContent/></Suspense>;
}
