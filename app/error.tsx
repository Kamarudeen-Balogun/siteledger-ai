"use client";
import { StatusPage } from "@/components/status-page";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <StatusPage code="500" title="We couldn’t open this page." description="Try opening it again. If you just submitted or approved work, check its status before repeating the action." retry={() => { reset(); window.location.reload(); }} />;
}
