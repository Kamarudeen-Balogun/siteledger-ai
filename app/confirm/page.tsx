import type { Metadata } from "next";
import { TelegramReview } from "@/components/telegram-review";
export const metadata: Metadata = { title: "SiteLedger site diary", referrer: "no-referrer", robots: { index: false, follow: false } };
export default function Page() { return <TelegramReview />; }
