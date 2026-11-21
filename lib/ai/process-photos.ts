import "server-only";
import { randomUUID } from "node:crypto";
import { intakeRpc } from "../telegram/storage";
import { readEvidence } from "../confirm/data";
import { analysePhoto, type PhotoInput, type PhotoResult } from "./analyse-photo";

export type PhotoJob = { photo_id: string; submission_id: string; storage_url: string };
export type PhotoProcessingDependencies = {
  list: (id: string) => Promise<string[]>;
  claim: (id: string, owner: string) => Promise<PhotoJob | null>;
  download: (job: PhotoJob) => Promise<PhotoInput>;
  analyse: typeof analysePhoto;
  finish: (id: string, owner: string, result: PhotoResult | { findings: null; error: "photo_unavailable" }) => Promise<void>;
  release: (id: string, owner: string) => Promise<void>;
};
const photoDependencies: PhotoProcessingDependencies = {
  list: id => intakeRpc("pending_photo_analysis", { p_submission_id: id }),
  claim: (id, owner) => intakeRpc("claim_photo_analysis", { p_photo_id: id, p_owner: owner }),
  download: async job => {
    const source = await readEvidence(job.storage_url, false);
    return { bytes: new Uint8Array(source.bytes), contentType: source.contentType.split(";")[0] as PhotoInput["contentType"] };
  },
  analyse: analysePhoto,
  finish: (id, owner, result) => intakeRpc("finish_photo_analysis", { p_photo_id: id, p_owner: owner,
    p_findings: result.findings, p_error: result.error }),
  release: (id, owner) => intakeRpc("release_photo_analysis", { p_photo_id: id, p_owner: owner }),
};
export async function processSubmissionPhotos(id: string, dependencies: PhotoProcessingDependencies = photoDependencies) {
  let ids: string[];
  try { ids = (await dependencies.list(id)).slice(0, 5); } catch { return; }
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(ids.length, 3) }, async () => {
    while (next < ids.length) {
      const photoId = ids[next++], owner = randomUUID();
      try {
        const job = await dependencies.claim(photoId, owner);
        if (!job) continue;
        let input: PhotoInput;
        try { input = await dependencies.download(job); }
        catch { await dependencies.finish(photoId, owner, { findings: null, error: "photo_unavailable" }); continue; }
        await dependencies.finish(photoId, owner, await dependencies.analyse(input));
      } catch {
        // RPC retry is durable and capped in the database. Never log private
        // image URLs, bytes, provider output or credentials.
        await dependencies.release(photoId, owner).catch(() => undefined);
      }
    }
  }));
}
