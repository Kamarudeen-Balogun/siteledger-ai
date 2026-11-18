import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const commands = [
  { command: "start", description: "Connect your Telegram account to a site" },
  { command: "today", description: "Review today's latest site note" },
  { command: "help", description: "How to send a voice note and site photos" },
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
  const menuUrl = new URL("/confirm", origin).toString();
  const page = await fetch(menuUrl, { headers: { "ngrok-skip-browser-warning": "true" }, signal: AbortSignal.timeout(15000) });
  if (!page.ok) throw new Error("Menu page unavailable");
  await call("setMyCommands", { commands });
  await call("setChatMenuButton", { menu_button: { type: "web_app", text: "SiteLedger", web_app: { url: menuUrl } } });
  const menu = await call("getChatMenuButton");
  const savedCommands = await call("getMyCommands");
  if (menu.type !== "web_app" || menu.web_app?.url !== menuUrl
    || JSON.stringify(savedCommands) !== JSON.stringify(commands)) throw new Error("Settings not saved");
  console.log("SiteLedger Mini App menu and /start, /today, /help commands configured and verified.");
} catch {
  console.error("Could not configure SiteLedger's menu. Check the HTTPS app and bot configuration. No credentials printed.");
  process.exitCode = 1;
}
