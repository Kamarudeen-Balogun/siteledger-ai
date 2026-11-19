import { writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const cliEnv = {
  ...process.env,
  SUPABASE_HOME: join(projectRoot, "supabase", ".temp", "cli-home"),
  SUPABASE_PROFILE: "supabase",
};
const windows = process.platform === "win32";
const status = spawnSync(
  windows ? process.env.ComSpec ?? "cmd.exe" : "supabase",
  windows ? ["/d", "/s", "/c", "supabase.cmd status -o json"] : ["status", "-o", "json"],
  { cwd: projectRoot, env: cliEnv, encoding: "utf8", windowsHide: true },
);
if (status.status !== 0) {
  console.error("Start SiteLedger's local Supabase stack before configuring its environment.");
  process.exit(1);
}

const settings = JSON.parse(status.stdout);
if (settings.API_URL !== "http://127.0.0.1:55421" || !settings.ANON_KEY || !settings.SERVICE_ROLE_KEY) {
  throw new Error("Expected the isolated SiteLedger local development configuration.");
}
const localEnv = {
  NEXT_PUBLIC_SUPABASE_URL: settings.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: settings.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: settings.SERVICE_ROLE_KEY,
  OPENAI_API_KEY: "",
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_WEBHOOK_SECRET: "",
};

try {
  await writeFile(
    join(projectRoot, ".env.local"),
    Object.entries(localEnv).map(([key, value]) => `${key}=${value}`).join("\n") + "\n",
    { encoding: "utf8", flag: "wx" },
  );
  console.log("Created ignored .env.local with local development credentials. No keys were printed.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Existing .env.local preserved.");
}

if (process.argv.includes("--serve")) {
  if (process.argv.includes("--report-preview")) {
    localEnv.TELEGRAM_WEBHOOK_SECRET = "local-report-preview";
    localEnv.SITELEDGER_APP_URL = "http://127.0.0.1:3010";
  }
  // This temporary preview always uses local values, even if .env.local contains hosted credentials.
  const preview = spawn(
    process.execPath,
    [join(projectRoot, "node_modules", "next", "dist", "bin", "next"), "start", "--hostname", "127.0.0.1", "--port", "3010"],
    { cwd: projectRoot, env: { ...process.env, ...localEnv }, stdio: "inherit", windowsHide: true },
  );
  preview.on("exit", (code) => process.exit(code ?? 1));
  process.on("SIGINT", () => preview.kill("SIGINT"));
  process.on("SIGTERM", () => preview.kill("SIGTERM"));
}
