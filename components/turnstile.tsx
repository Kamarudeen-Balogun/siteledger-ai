"use client";
import { useEffect, useRef, useState } from "react";
type Widget = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
let sdk: Promise<Widget> | undefined;
function loadWidget(): Promise<Widget> {
  const existing = (window as Window & { turnstile?: Widget }).turnstile;
  if (existing) return Promise.resolve(existing);
  if (sdk) return sdk;
  sdk = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.async = true;
    const timeout = window.setTimeout(failed, 15000);
    function failed() { clearTimeout(timeout); script.remove(); sdk = undefined; reject(new Error("Bot check unavailable")); }
    script.onerror = failed;
    script.onload = () => {
      const api = (window as Window & { turnstile?: Widget }).turnstile;
      if (!api) { failed(); return; }
      // The async script has executed when load fires. ready() is reserved for
      // the non-async integration and throws when mixed with async/defer.
      clearTimeout(timeout); resolve(api);
    };
    document.head.appendChild(script);
  });
  return sdk;
}
function checkMessage(code: string) {
  if (code === "110200") return "This website is not authorized for the bot check yet. The site owner needs to update its allowed hostnames.";
  if (["110100", "110110"].includes(code)) return "The bot check's site key is invalid. The site owner needs to update the configuration.";
  if (["110500", "110510"].includes(code)) return "Open SiteLedger in an up-to-date browser and try the bot check again.";
  if (code === "110600") return "The bot check timed out. Retry when your connection is stable.";
  return "The bot check could not finish. Check your connection and retry.";
}
export function Turnstile({ siteKey, onToken, reset }: { siteKey: string; onToken: (token: string) => void; reset: number }) {
  const element = useRef<HTMLDivElement>(null), callback = useRef(onToken);
  const [attempt, setAttempt] = useState(0), [error, setError] = useState(""), [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  useEffect(() => { callback.current = onToken; }, [onToken]);
  useEffect(() => {
    if (!siteKey || !element.current) return;
    let active = true, id: string | undefined, widget: Widget | undefined;
    callback.current("");
    function fail(value = "") { if (!active) return; const reference = /^\d{6}$/.test(value) ? value : ""; callback.current(""); setVerified(false); setCode(reference); setError(checkMessage(reference)); }
    void loadWidget().then(api => {
      if (!active || !element.current) return;
      widget = api;
      setVerified(false); setError(""); setCode("");
      try {
        id = api.render(element.current, { sitekey: siteKey.trim(), theme: "light", size: "flexible", retry: "never",
          callback: (token: string) => { if (!active) return; callback.current(token); setVerified(true); setError(""); setCode(""); },
          "expired-callback": () => { if (!active) return; callback.current(""); setVerified(false); setError("The bot check expired. Complete a new check before continuing."); },
          "error-callback": (value: string) => { fail(value); return true; },
          "timeout-callback": () => fail("110600") });
      } catch { fail(); }
    }).catch(() => fail());
    return () => { active = false; if (id && widget) { try { widget.remove(id); } catch { /* Already removed. */ } } callback.current(""); };
  }, [siteKey, reset, attempt]);
  if (!siteKey) return <p role="status" className="my-4 border-l-4 border-accent pl-4 leading-7">Account signup is waiting for the Turnstile site key. Existing records are preserved.</p>;
  return <div className="my-5" data-bot-check data-check-error={code || undefined}><div ref={element} />
    {!error && !verified && <p role="status" className="mt-3 text-sm leading-6">Completing the bot check…</p>}
    {error && <div className="mt-3 border-l-4 border-accent pl-4"><p role="alert" className="leading-7">{error}</p><button type="button" className="mt-3 min-h-12 border border-ink px-4 py-3" onClick={() => { callback.current(""); setVerified(false); setError(""); setCode(""); setAttempt(value => value + 1); }}>Retry bot check</button></div>}
  </div>;
}
