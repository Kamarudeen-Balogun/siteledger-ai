import "server-only";

// The one place that knows which origin this deployment serves from.
//
// - The configured SITELEDGER_APP_URL when set (production).
// - Otherwise the deployment URL Vercel sets automatically per deployment
//   (VERCEL_URL), so a preview deployment serves its own origin.
// - "" when neither is set, which keeps every origin check closed.
export function appOrigin(): string {
  const configured = (process.env.SITELEDGER_APP_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const vercel = (process.env.VERCEL_URL ?? "").trim();
  if (vercel) return `https://${vercel}`;
  return "";
}

// Every origin a browser request to this deployment may legitimately come
// from. This is a closed allowlist of deployment-controlled values — the
// configured app origin plus the URLs Vercel assigns to this project
// (VERCEL_URL for this deployment, VERCEL_PROJECT_PRODUCTION_URL for
// production). It is needed because a preview deployment keeps the
// production SITELEDGER_APP_URL in its environment while serving from its
// own preview hostname: accepting only the configured origin would reject
// every request made on the preview. Unrelated origins are still rejected.
export function allowedAppOrigins(): string[] {
  const origins: string[] = [];
  const add = (value: string | undefined) => {
    if (!value) return;
    const raw = value.trim().replace(/\/+$/, "");
    if (!raw) return;
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(candidate);
      if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password && !origins.includes(url.origin)) origins.push(url.origin);
    } catch { /* A malformed deployment value never opens the check. */ }
  };
  add(process.env.SITELEDGER_APP_URL);
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  return origins;
}

export function isAllowedAppOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return allowedAppOrigins().includes(origin);
}

export function isAllowedAppHostname(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  return allowedAppOrigins().some(candidate => {
    try { return new URL(candidate).hostname === hostname; } catch { return false; }
  });
}
