import { createHash } from "node:crypto";
import { smallJson } from "@/lib/auth/request";
import { intakeRpc } from "@/lib/telegram/storage";
import { sendProductEmail } from "@/lib/email/send";
import { appOrigin, isAllowedAppHostname, isAllowedAppOrigin } from "@/lib/app-url";

const reply = (body: unknown, status = 200) => Response.json(body, { status });
const topics = ["Product question", "Feedback or improvement", "Report a problem", "Something else"] as const;
const roles = ["Foreman", "Site Engineer", "Project Manager / QS", "Client", "Viewer", "Other — custom role"] as const;

async function verifyCaptcha(token: unknown) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || !appOrigin()) throw new Error("The contact form is waiting for its bot-check setup.");
  if (typeof token !== "string" || !token || token.length > 2048) throw new Error("Complete a fresh bot check.");
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ secret, response: token }), redirect: "error", signal: AbortSignal.timeout(10000) });
  const result = await response.json();
  if (!response.ok || result.success !== true || !isAllowedAppHostname(result.hostname)) throw new Error("Complete a fresh bot check before sending.");
}

export async function POST(request: Request) {
  if (!isAllowedAppOrigin(request.headers.get("origin"))) return reply({ error: "Open the contact form in SiteLedger." }, 403);
  try {
    const input = await smallJson(request, 20000);
    const text = (value: unknown, max: number, required = true) => typeof value === "string" && value.trim().length > 0 && value.length <= max ? value.trim() : required ? null : "";
    const name = text(input.name, 120);
    const email = text(input.email, 254);
    const role = text(input.role, 120, false) ?? "";
    const customRole = text(input.custom_role, 120, false) ?? "";
    const topic = typeof input.topic === "string" && (topics as readonly unknown[]).includes(input.topic) ? input.topic : null;
    const message = text(input.message, 5000);
    const roleOk = !role || (roles as readonly unknown[]).includes(role);
    const customOk = role !== "Other — custom role" || customRole.length > 0;
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !roleOk || !customOk || !topic || !message || message.length < 10) return reply({ error: "Add your name, a valid email, a topic and a message of at least 10 characters." }, 422);
    const key = `contact:${createHash("sha256").update(email.toLowerCase()).digest("hex")}`;
    if (!await intakeRpc("account_limit", { p_key: key, p_max: 5, p_seconds: 3600 })) return reply({ error: "Wait before sending another message." }, 429);
    await verifyCaptcha(input.captcha_token);
    await sendProductEmail("kamarudeen@codeflowx.dev", `SiteLedger contact — ${topic}`, `From: ${name} <${email}>\nRole on site: ${role ? (role === "Other — custom role" ? customRole : role) : "Not given"}\nTopic: ${topic}\n\n${message}`, "feedback");
    return reply({ sent: true }, 201);
  } catch (error) { return reply({ error: error instanceof Error && error.message.startsWith("Complete") ? error.message : "Could not send your message. Try again." }, 503); }
}
