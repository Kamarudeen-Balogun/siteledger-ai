import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
try {
  const base = new URL(process.argv[2]);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash)
    throw new Error("An HTTPS app origin is required.");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret || !/^[A-Za-z0-9_-]{1,256}$/.test(secret))
    throw new Error("Telegram configuration is incomplete or invalid.");
  async function call(method, body = {}) {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error("Telegram request failed.");
    return result.result;
  }
  const bot = await call("getMe");
  if (bot.username.toLowerCase() !== "siteledgerngbot") throw new Error("Unexpected bot.");
  const webhookUrl = new URL("/api/telegram/webhook", base).toString();
  // A correctly configured route must reject requests that omit the secret.
  const probe = await fetch(webhookUrl, {
    method: "POST", headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
    body: "{}", redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (probe.status !== 401) throw new Error("Webhook secret check failed.");
  await call("setWebhook", { url: webhookUrl, secret_token: secret,
    allowed_updates: ["message"], max_connections: 1, drop_pending_updates: false });
  const info = await call("getWebhookInfo");
  if (info.url !== webhookUrl) throw new Error("Webhook URL was not saved.");
  console.log(`Webhook registered for @${bot.username}: ${webhookUrl}`);
  console.log(`Pending updates preserved: ${info.pending_update_count}`);
} catch {
  console.error("Webhook setup failed. Check the HTTPS app, bot identity, and Telegram environment variables. No credentials were printed.");
  process.exitCode = 1;
}
