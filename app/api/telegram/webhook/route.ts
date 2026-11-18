import { handleTelegramWebhook, intakeDependencies } from "@/lib/telegram/webhook";

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleTelegramWebhook(request, intakeDependencies, process.env.TELEGRAM_WEBHOOK_SECRET);
}
