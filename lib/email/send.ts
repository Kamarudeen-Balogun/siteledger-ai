import "server-only";

export async function sendProductEmail(recipient: string, subject: string, message: string, purpose: "invitation" | "feedback" = "invitation", requestId?: string) {
  const key = process.env.SITELEDGER_RESEND_API_KEY;
  const feedback = purpose === "feedback";
  const from = (feedback ? process.env.SITELEDGER_FEEDBACK_FROM : undefined) || process.env.SITELEDGER_EMAIL_FROM;
  const replyTo = feedback ? process.env.SITELEDGER_FEEDBACK_REPLY_TO : undefined;
  if (!key || !from) throw new Error("Email delivery is unavailable. Try again later.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(requestId ? { "Idempotency-Key": `siteledger-deletion-${requestId}` } : {}) },
    body: JSON.stringify({ from, to: [recipient], subject, text: message, ...(replyTo ? { reply_to: replyTo } : {}) }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Email delivery could not finish. Try again.");
}
