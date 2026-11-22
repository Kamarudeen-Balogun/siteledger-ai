import { handleTelegramWebhook, intakeDependencies } from "@/lib/telegram/webhook";
import { processSubmission } from "@/lib/ai/process-submission";
import { processSubmissionPhotos } from "@/lib/ai/process-photos";
import { after } from "next/server";

export const maxDuration = 300;

export async function POST(request: Request) {
  return handleTelegramWebhook(request, intakeDependencies, process.env.TELEGRAM_WEBHOOK_SECRET,
    (id) => after(async () => { await Promise.all([processSubmission(id), processSubmissionPhotos(id)]); }));
}
