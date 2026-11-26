"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Script from "next/script";
import { resolveClientAccount } from "@/lib/auth/client-session";

// Landing links share the workspace account bootstrap.
export function LandingAccountLink({ className, anonymousLabel, activeHref = "/projects", activeLabel = "Open your projects", trial = false }: { className?: string; anonymousLabel: string; activeHref?:string; activeLabel?:string; trial?:boolean }) {
  const [active, setActive] = useState(false);
  function check() { void resolveClientAccount().then(account => setActive(Boolean(account))).catch(() => setActive(false)); }
  useEffect(() => { let mounted = true; void resolveClientAccount().then(value => { if (mounted) setActive(Boolean(value)); }).catch(() => undefined); return () => { mounted = false; }; }, []);
  return <><Script src="https://telegram.org/js/telegram-web-app.js" onReady={check}/>{(!trial||!active)&&<Link href={trial ? "/trial" : active ? activeHref : "/account"} prefetch={false} className={className}>{active ? activeLabel : anonymousLabel}</Link>}</>;
}
