"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
type Widget = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
export function Turnstile({ siteKey, onToken, reset }: { siteKey: string; onToken: (token: string) => void; reset: number }) {
  const element = useRef<HTMLDivElement>(null), callback = useRef(onToken);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  useEffect(() => { callback.current = onToken; }, [onToken]);
  useEffect(() => {
    const api = (window as Window & { turnstile?: Widget }).turnstile;
    if (!ready || !api || !element.current || !siteKey) return;
    callback.current("");
    const id = api.render(element.current, { sitekey: siteKey, theme: "light", size: "flexible", callback: (token: string) => { callback.current(token); setError(""); },
      "expired-callback": () => callback.current(""), "error-callback": () => { callback.current(""); setError("The bot check could not load. Check your connection and try again."); } });
    return () => { api.remove(id); callback.current(""); };
  }, [ready, siteKey, reset]);
  if (!siteKey) return <p role="status" className="my-4 border-l-4 border-accent pl-4 leading-7">Account signup is waiting for the Turnstile site key. Existing records are preserved.</p>;
  return <div className="my-5"><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} onError={() => setError("The bot check could not load. Check your connection.")} /><div ref={element} />{error && <p role="alert" className="mt-3 text-[#B91C1C]">{error}</p>}</div>;
}
