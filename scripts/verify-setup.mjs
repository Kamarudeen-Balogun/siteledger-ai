import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const token = process.env.TELEGRAM_BOT_TOKEN;
const headers = key
  ? { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) }
  : {};

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"]) {
  console.log(`${name}: ${process.env[name] ? "set" : "missing"}`);
}
console.log(`Supabase target: ${url && new URL(url).hostname.endsWith(".supabase.co") ? "hosted project" : "local or custom project"}`);
console.log(`Server key format: ${key?.startsWith("sb_secret_") ? "secret API key" : key?.startsWith("eyJ") ? "legacy JWT" : "other or missing"}`);

const results = await Promise.allSettled([
  (async () => {
    if (!url || !key) throw new Error("Supabase configuration is incomplete.");
    const response = await fetch(new URL("/rest/v1/project_summary?select=project_code,locked_report_count&project_code=eq.LEKKI-DEMO-01", url), { headers, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      console.log(`Supabase schema check: HTTP ${response.status}`);
      const body = await response.json().catch(() => ({}));
      console.log(`Database error code: ${body.code ?? "unavailable"}`);
      throw new Error("The SiteLedger schema is not ready.");
    }
    const projects = await response.json();
    console.log(`Supabase schema check: connected; demo rows ${projects.length}; locked reports ${projects[0]?.locked_report_count ?? 0}`);
    if (projects.length !== 1 || Number(projects[0]?.locked_report_count) < 12) {
      throw new Error("The SiteLedger demo seed is not ready.");
    }
  })(),
  (async () => {
    if (!token) throw new Error("Telegram token is missing.");
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(15_000) });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error("Telegram credentials could not be verified.");
    console.log(`Telegram bot: @${body.result.username}`);
    if (body.result.username.toLowerCase() !== "siteledgerngbot") throw new Error("Telegram token belongs to a different bot.");
    const webhook = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { signal: AbortSignal.timeout(15_000) }).then((res) => res.json());
    console.log(`Telegram webhook: ${webhook.result?.url ? "configured" : "not configured"}; pending updates ${webhook.result?.pending_update_count ?? 0}`);
  })(),
]);
for (const result of results) {
  if (result.status === "rejected") console.log("A setup check failed; inspect the relevant configuration or connection.");
}
if (results.some((result) => result.status === "rejected")) process.exitCode = 1;
