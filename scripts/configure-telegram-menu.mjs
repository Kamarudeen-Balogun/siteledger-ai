import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const commands = [
  { command: "start", description: "Get started or see your active project" },
  { command: "account", description: "Sign in, recover access or connect your account" },
  { command: "projects", description: "Choose an authorized project" },
  { command: "today", description: "Review today's latest note and costed progress" },
  { command: "reports", description: "Open your saved project records" },
  { command: "help", description: "See the steps for voice notes and site photos" },
  { command: "logout", description: "Sign out of Telegram access; keep your records" },
];
try {
  const origin = new URL(process.env.SITELEDGER_APP_URL ?? "");
  if (origin.protocol !== "https:" || origin.origin !== process.env.SITELEDGER_APP_URL) throw new Error("App origin");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Bot configuration");
  async function call(method, body = {}) {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      redirect: "error", signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error("Telegram request");
    return result.result;
  }
  const bot = await call("getMe");
  if (bot.username?.toLowerCase() !== "siteledgerngbot") throw new Error("Unexpected bot");
  const menuUrl = new URL("/account", origin).toString();
  const page = await fetch(menuUrl, { headers: { "ngrok-skip-browser-warning": "true" }, signal: AbortSignal.timeout(15000) });
  if (!page.ok) throw new Error("Menu page unavailable");
  const webhook = await call("getWebhookInfo");
  if (webhook.url !== new URL("/api/telegram/webhook", origin).toString()) throw new Error("Webhook does not match this app");
  // Require the matching schema before publishing commands to the live bot.
  const database = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!database || !service) throw new Error("Database configuration");
  const ready = await fetch(new URL("/rest/v1/rpc/account_bot_today", database), {method:"POST",headers:{apikey:service,...(service.startsWith("eyJ")?{Authorization:`Bearer ${service}`} : {}),"Content-Type":"application/json"},body:JSON.stringify({p_telegram:0}),signal:AbortSignal.timeout(10000)});
  if (!ready.ok) throw new Error("Account bot schema unavailable");
  await call("setMyCommands", { commands });
  await call("setChatMenuButton", { menu_button: { type: "web_app", text: "SiteLedger", web_app: { url: menuUrl } } });
  const menu = await call("getChatMenuButton");
  const savedCommands = await call("getMyCommands");
  if (menu.type !== "web_app" || menu.web_app?.url !== menuUrl
    || JSON.stringify(savedCommands) !== JSON.stringify(commands)) throw new Error("Settings not saved");
  console.log("SiteLedger account Mini App and all seven commands configured and verified.");
} catch {
  console.error("Could not configure SiteLedger's menu. Check the HTTPS app and bot configuration. No credentials printed.");
  process.exitCode = 1;
}
