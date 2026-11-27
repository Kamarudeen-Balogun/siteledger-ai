import type { Metadata } from "next";
import { InformationPage } from "@/components/public-site";

export const metadata: Metadata = { title: "About — SiteLedger AI", description: "What SiteLedger is, how a voice note becomes a costed daily record, and who built it." };
const card = "rounded-xl bg-surface-container-lowest p-4 shadow-sm";
const h2 = "font-headline-md text-headline-md text-on-surface";
const p = "mt-2 font-body-md text-body-md leading-relaxed text-on-surface-variant";

export default function AboutPage() {
  return <InformationPage current="/about" label="About" title="About SiteLedger" intro={<p>A voice note tells you what happened. A costed, confirmed record helps explain what that work means for the project.</p>}>
    <section className={card}>
      <h2 className={h2}>From verbal updates to dated proof</h2>
      <p className={p}>A foreman’s update, a phone gallery and a price list often live in separate places. SiteLedger brings them into a daily report: work items, quantities, supplied rates, photos and the people who confirmed and approved it.</p>
      <p className={p}>The Nigerian demonstration uses naira, Nigerian English and Pidgin site terms. Private projects select their own currency and timezone; prices always come from that project’s BoQ.</p>
    </section>
    <section className={card}>
      <h2 className={h2}>The person stays in charge</h2>
      <p className={p}>AI transcribes and suggests structured work items and possible photo findings. A person checks the quantities and observations before costing. A PM then approves the report in a separate action, including on a one-person project.</p>
      <p className={p}>A locked original cannot be silently rewritten. A correction becomes an amendment with its own author and timestamp. Your reports are locked once approved.</p>
    </section>
    <section className={card}>
      <h2 className={h2}>About the builder</h2>
      <p className={p}>Built by Balogun Kamarudeen Ayomide — Civil Engineer &amp; AI Automation Specialist</p>
      <p className={p}><a className="text-link" href="https://codeflowx.dev" target="_blank" rel="noreferrer">codeflowx.dev</a> · <a className="text-link" href="mailto:kamarudeen@codeflowx.dev">kamarudeen@codeflowx.dev</a> · <a className="text-link" href="https://github.com/Kamarudeen-Balogun/siteledger-ai" target="_blank" rel="noreferrer">GitHub</a> · <a className="text-link" href="https://t.me/SiteLedgerNGbot" target="_blank" rel="noreferrer">Telegram @SiteLedgerNGbot</a></p>
      <p className={p}>The public Lekki duplex and its client are fictional. Its rates are illustrative. Synthetic demonstration photos are labelled; the public sample never includes a user’s private uploads.</p>
    </section>
  </InformationPage>;
}
