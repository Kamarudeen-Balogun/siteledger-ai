import { privateHeaders } from "@/lib/auth/api";
import { accountForHash, requestSessionHash } from "@/lib/auth/session";
import { smallJson } from "@/lib/auth/request";
import { UUID } from "@/lib/confirm/access";
import { validReviewDraft } from "@/lib/confirm/draft";
import { intakeRpc } from "@/lib/telegram/storage";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders });
  if (request.headers.get("origin") !== process.env.SITELEDGER_APP_URL) return reply({ error: "Open the site note in SiteLedger." }, 403);
  const { id } = await params, hash = requestSessionHash(request);
  if (!hash || !UUID.test(id)) return reply({ error: "Site note unavailable." }, 404);
  try {
    const actor = await accountForHash(hash);
    if (!actor) return reply({ error: "Sign in to save your draft." }, 401);
    if (!await intakeRpc("account_limit", { p_key: `review-draft:${actor.profile_id}`, p_max: 50, p_seconds: 600 })) return reply({ error: "Wait a little before saving again." }, 429);
    const value = await smallJson(request, 90000);
    if (!validReviewDraft(value)) return reply({ error: "This draft is too large to save. Shorten the notes and retry." }, 422);
    const result = await intakeRpc("account_review_draft", { p_hash: hash, p_id: id, p_payload: value });
    return result ? reply({ saved: true }) : reply({ error: "This site note is no longer available for editing." }, 404);
  } catch { return reply({ error: "Could not save your draft. Your edits are still on this screen." }, 503); }
}
