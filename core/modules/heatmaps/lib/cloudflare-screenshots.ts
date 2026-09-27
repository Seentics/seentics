import { createHash } from "node:crypto";
import { log as baseLog } from "../../../platform/observability/logger";
import type { CaptureResult, ScreenshotOptions } from "./playwright-screenshots";

const log = baseLog.child({ category: "cloudflare_screenshots" });

export interface CloudflareScreenshotConfig {
  accountId: string;
  apiToken: string;
}

/** Same freeze the local capture injects, so both renderers produce the same frame. */
const DISABLE_ANIMATIONS_CSS =
  "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }";

/** Every failure carries this prefix, which `captureAndStoreScreenshot` treats as final. */
const FAILURE = "Screenshot capture failed (Cloudflare)";

/**
 * Capture a page on Cloudflare Browser Rendering's REST screenshot endpoint.
 *
 * Mirrors the local Playwright capture — viewport, load then a short settle, frozen
 * animations, full-page JPEG — and returns the same shape, so storage, dedupe and the
 * snapshot row downstream cannot tell which renderer ran.
 *
 * Two local safeguards have no equivalent here, deliberately:
 *
 * - The per-request DNS policy. It exists to stop a hostile page steering *our* server's
 *   browser at private addresses and cloud metadata. Cloudflare's browser is not on our
 *   network, so there is nothing of ours for it to reach. The target itself is still
 *   checked against the website's domain by `captureForResolved` before this runs.
 * - The login-redirect check. The endpoint returns only the image, never the final URL,
 *   so a page that bounces to a sign-in form is stored as that sign-in form.
 *
 * Document dimensions come from the JPEG header: at a device scale factor of 1 a
 * full-page capture is exactly the document's CSS size, which is what the local capture
 * measures with `scrollWidth`/`scrollHeight`.
 */
export async function captureWithCloudflare(
  config: CloudflareScreenshotConfig,
  options: ScreenshotOptions,
): Promise<CaptureResult> {
  try {
    new URL(options.url);
  } catch {
    throw new Error(`Invalid URL: ${options.url}`);
  }

  const timeoutMs = Math.min(60_000, options.timeoutMs ?? 30_000);
  const body = {
    url: options.url,
    viewport: {
      width: Math.max(320, Math.min(3840, options.viewportWidth ?? 1920)),
      height: Math.max(240, Math.min(2160, options.viewportHeight ?? 1080)),
      deviceScaleFactor: 1,
    },
    gotoOptions: { waitUntil: "load", timeout: timeoutMs },
    // Matches the local capture's settle after `load` — fonts and late layout.
    waitForTimeout: 500,
    addStyleTag: [{ content: DISABLE_ANIMATIONS_CSS }],
    ...(options.waitForSelector
      ? { waitForSelector: { selector: options.waitForSelector, timeout: timeoutMs } }
      : {}),
    screenshotOptions: {
      type: "jpeg",
      quality: Math.max(1, Math.min(100, options.jpegQuality ?? 85)),
      fullPage: true,
    },
  };

  log.info({ msg: "cloudflare_capture_start", url: options.url });

  let res: Response;
  try {
    res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/browser-rendering/screenshot`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        // Page load plus selector wait plus upload; past this the render is not coming back.
        signal: AbortSignal.timeout(timeoutMs * 2 + 15_000),
      },
    );
  } catch (error) {
    throw new Error(`${FAILURE}: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Failures arrive as a JSON envelope; success is the image itself.
  const contentType = res.headers.get("Content-Type") ?? "";
  if (!res.ok || !contentType.startsWith("image/")) {
    throw new Error(`${FAILURE} (HTTP ${res.status}): ${await errorMessage(res)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
    throw new Error(`${FAILURE}: response is not a valid JPEG`);
  }

  const dims = jpegDimensions(buffer);
  if (!dims) throw new Error(`${FAILURE}: could not read image dimensions`);
  if (dims.width * dims.height > 80_000_000 || dims.height > 60_000) {
    throw new Error(`${FAILURE}: page is too large to capture safely: ${dims.width}x${dims.height}`);
  }

  const hash = createHash("sha256").update(buffer).digest("hex");
  log.info({
    msg: "cloudflare_capture_success",
    url: options.url,
    width: dims.width,
    height: dims.height,
    bytes: buffer.length,
  });

  return { buffer, width: dims.width, height: dims.height, hash };
}

async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { errors?: Array<{ message?: string }> };
    const messages = (parsed.errors ?? []).map((e) => e.message).filter(Boolean);
    if (messages.length > 0) return messages.join("; ");
  } catch {
    // Not JSON — fall through to the raw body.
  }
  return text.slice(0, 300) || res.statusText || "no response body";
}

/**
 * Width and height from a JPEG's start-of-frame segment.
 *
 * Walks the marker segments rather than scanning for the bytes, since `FF C0` can occur
 * inside other segments' payloads. Returns null for anything that is not a well-formed
 * baseline or progressive JPEG.
 */
export function jpegDimensions(buf: Buffer): { width: number; height: number } | null {
  let i = 2; // past SOI
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1]!;
    if (marker === 0xff) { i += 1; continue; } // fill byte
    // Standalone markers carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { i += 2; continue; }
    const length = buf.readUInt16BE(i + 2);
    // SOF0–SOF15, excluding DHT (C4), JPG (C8) and DAC (CC), which share the range.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (i + 9 > buf.length) return null;
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}
