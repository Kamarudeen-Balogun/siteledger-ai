import "server-only";
import sharp from "sharp";

const extensions: Record<string,string> = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" };
export async function normalizedImage(bytes: Uint8Array, expected: string, maxBytes: number, width: number) {
  if (!bytes.byteLength || bytes.byteLength > maxBytes) throw new Error("The photo is too large.");
  const image = sharp(bytes, { limitInputPixels: 24_000_000, failOn: "warning" });
  const metadata = await image.metadata().catch(() => null);
  const format = extensions[expected.toLowerCase().replace(/^image\//, "")];
  if (!metadata || !format || metadata.format !== format || (metadata.pages ?? 1) > 1) throw new Error("That file is not a real image.");
  const output = await image.rotate().resize({ width, height: width, fit: "inside", withoutEnlargement: true }).flatten({ background: "#fff" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer()
    .catch(() => { throw new Error("That file is not a real image."); });
  if (output.length > maxBytes) throw new Error("The photo is too large.");
  return output;
}

export function imageExtension(name: string) { return name.split(".").at(-1)?.toLowerCase() ?? ""; }
