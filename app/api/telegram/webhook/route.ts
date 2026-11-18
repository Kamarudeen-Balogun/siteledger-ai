import { handleTelegramWebhook, intakeDependencies } from "@/lib/telegram/webhook";
import { processSubmission } from "@/lib/ai/process-submission";
import { after } from "next/server";

export const maxDuration = 120;

export async function POST(request: Request) {
  return handleTelegramWebhook(request, intakeDependencies, process.env.TELEGRAM_WEBHOOK_SECRET,
    (id) => after(async () => { await processSubmission(id); }));
}
