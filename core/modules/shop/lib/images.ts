/** Product photos: what an upload really is, by its first bytes, never by its name or stated type. */

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export type ImageKind = { ext: "jpg" | "png" | "webp"; contentType: string };

export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", contentType: "image/jpeg" };
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) {
    return { ext: "png", contentType: "image/png" };
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

/** Object keys under `shop/`, and the public path the shop host serves each at: /i/<id>.<ext>. */
export const IMAGE_ID = /^[a-f0-9]{32}\.(?:jpg|png|webp)$/;
export const imageKey = (id: string): string => `shop/images/${id}`;
