"use client";
import "./globals.css";
import { StatusPage } from "@/components/status-page";
import { CreatorCredit } from "@/components/creator-credit";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en-NG"><body><StatusPage code="500" title="SiteLedger couldn’t load." description="Open it again when your connection is stable. Check the status of any recent action before trying it again." retry={() => { reset(); window.location.reload(); }} /><CreatorCredit /></body></html>;
}
