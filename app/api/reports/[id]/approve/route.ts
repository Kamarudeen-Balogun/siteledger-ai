import { logAction } from "@/lib/log/api";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return logAction(request, context, "approve");
}
