import Link from "next/link";
import { InformationPage } from "@/components/public-site";
import { ContactDesk } from "@/components/contact-desk";
import { ContactForm } from "@/components/contact-form";
export const metadata={title:"Contact — SiteLedger AI",description:"Reach Kamarudeen Balogun at CodeFlowX for SiteLedger product questions and project feedback."};
export default function Contact(){return <InformationPage current="/contact" label="Talk to the builder" title="Questions from the site are welcome." intro={<p>SiteLedger AI is built by Kamarudeen Balogun at CodeFlowX. Use the verified creator links below for product feedback and enquiries.</p>}>
  <ContactDesk/>
  <ContactForm siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} />
  <section><h2>Looking for the next step?</h2><Link className="text-link" href="/help">Read the account and site-record guide</Link><br/><Link className="text-link" href="/account/recover">Recover account access</Link></section>
  </InformationPage>;}
