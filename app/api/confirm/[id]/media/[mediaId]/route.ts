import { getReview, readEvidence } from "@/lib/confirm/data";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request, context: { params: Promise<{ id: string; mediaId: string }> }) {
  try {
    const { id, mediaId } = await context.params;
    const record = await getReview(id, new URL(request.url).searchParams.get("access") ?? "");
    const path = mediaId === "audio" ? record?.audio_url : record?.photos.find(photo => photo.id === mediaId)?.storage_url;
    if (!path) return new Response("Evidence unavailable.", { status: 404, headers });
    const media = await readEvidence(path, mediaId === "audio");
    return new Response(media.bytes, { headers: { ...headers, "Content-Type": media.contentType } });
  } catch { return new Response("Evidence temporarily unavailable.", { status: 503, headers }); }
}
