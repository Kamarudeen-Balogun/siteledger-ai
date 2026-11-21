import { accountApi } from "@/lib/auth/api";
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) { return accountApi(request, (await context.params).action); }
