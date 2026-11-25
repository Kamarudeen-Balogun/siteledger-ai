"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Script from "next/script";
import { resolveClientAccount } from "@/lib/auth/client-session";

// Header, mobile menu and hero share one lookup per landing-page visit.
// This controls link presentation only; destination routes authorize access.
export function LandingAccountLink({ className, anonymousLabel }: { className?: string; anonymousLabel: string }) {
  const [active, setActive] = useState(false);
  function check() { void resolveClientAccount().then(account => setActive(Boolean(account))).catch(() => setActive(false)); }
  useEffect(() => { let mounted = true; void resolveClientAccount().then(value => { if (mounted) setActive(Boolean(value)); }).catch(() => undefined); return () => { mounted = false; }; }, []);
  return <><Script src="https://telegram.org/js/telegram-web-app.js" onReady={check}/><Link href={active ? "/projects" : "/account"} prefetch={false} className={className}>{active ? "Open your projects" : anonymousLabel}</Link></>;
}
