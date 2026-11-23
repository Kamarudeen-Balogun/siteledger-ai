"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

// Header, mobile menu and hero share one lookup per landing-page visit.
// This controls link presentation only; destination routes authorize access.
let pending: Promise<boolean> | null = null;
function activeSession() {
  pending ??= fetch("/api/account", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000) })
    .then(async response => response.ok && Boolean((await response.json()).account?.profile_id))
    .catch(() => false).finally(() => { pending = null; });
  return pending;
}
export function LandingAccountLink({ className, anonymousLabel }: { className?: string; anonymousLabel: string }) {
  const [active, setActive] = useState(false);
  useEffect(() => { let mounted = true; void activeSession().then(value => { if (mounted) setActive(value); }); return () => { mounted = false; }; }, []);
  return <Link href={active ? "/projects" : "/account"} prefetch={false} className={className}>{active ? "Open your projects" : anonymousLabel}</Link>;
}
