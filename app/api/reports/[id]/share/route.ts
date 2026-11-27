import { privateHeaders } from "@/lib/auth/api";
import { isAllowedAppOrigin } from "@/lib/app-url";
import { smallJson } from "@/lib/auth/request";
import { requestSessionHash } from "@/lib/auth/session";
import { UUID } from "@/lib/confirm/access";
import { intakeRpc } from "@/lib/telegram/storage";

async function share(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: privateHeaders });
  const hash = requestSessionHash(request), { id } = await params;
  if (!hash || !UUID.test(id)) return reply({ error: "Report unavailable." }, 404);
  try {
    const write = request.method === "POST";
    if (write && !isAllowedAppOrigin(request.headers.get("origin"))) return reply({ error: "Open this report in SiteLedger." }, 403);
    const input = write ? await smallJson(request, 128) : null;
    if (input && (Object.keys(input).length !== 1 || typeof input.enable !== "boolean")) return reply({ error: "Choose whether to share this report." }, 422);
    const result = await intakeRpc<{ share_id: string | null } | null>("account_report_share", { p_hash: hash, p_submission: id, p_enable: input?.enable ?? null });
    if (!result) return reply({ error: "Report unavailable." }, 404);
    return reply({ path: result.share_id ? `/shared/${result.share_id}` : null });
  } catch {
    return reply({ error: "Could not update report sharing. Try again." }, 503);
  }
}
export const GET = share;
export const POST = share;
