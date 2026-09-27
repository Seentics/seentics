import { describe, it, expect, afterEach } from "bun:test";

process.env.DATABASE_URL ??= "postgres://test-not-connected";

import { captureWithCloudflare, jpegDimensions } from "../lib/cloudflare-screenshots";
import { withCaptureSlot } from "../lib/capture-slot";

/** Smallest byte sequence `jpegDimensions` accepts: SOI, an APP0 segment, then SOF0. */
function fakeJpeg(width: number, height: number): Buffer {
  const app0 = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
  const sof0 = [0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x01, 0x01, 0x11, 0x00];
  return Buffer.from([0xff, 0xd8, ...app0, ...sof0, 0xff, 0xd9]);
}

const config = { accountId: "acct-1", apiToken: "token-1" };
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function stubFetch(response: () => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return response();
  }) as typeof fetch;
  return calls;
}

describe("jpegDimensions", () => {
  it("reads width and height from the start-of-frame segment", () => {
    expect(jpegDimensions(fakeJpeg(1920, 5400))).toEqual({ width: 1920, height: 5400 });
  });

  it("returns null for bytes that are not a JPEG segment stream", () => {
    expect(jpegDimensions(Buffer.from([0xff, 0xd8, 0x00, 0x00, 0x00]))).toBeNull();
  });
});

describe("captureWithCloudflare", () => {
  it("posts a full-page JPEG request and returns the image's dimensions", async () => {
    const calls = stubFetch(() => new Response(new Uint8Array(fakeJpeg(1440, 3200)), { headers: { "Content-Type": "image/jpeg" } }));

    const result = await captureWithCloudflare(config, {
      url: "https://example.com/pricing",
      viewportWidth: 1440,
      viewportHeight: 900,
      waitForSelector: "#app",
      jpegQuality: 70,
    });

    expect(result.width).toBe(1440);
    expect(result.height).toBe(3200);
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);

    expect(calls[0]!.url).toBe("https://api.cloudflare.com/client/v4/accounts/acct-1/browser-rendering/screenshot");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.viewport).toEqual({ width: 1440, height: 900, deviceScaleFactor: 1 });
    expect(body.screenshotOptions).toEqual({ type: "jpeg", quality: 70, fullPage: true });
    expect(body.waitForSelector.selector).toBe("#app");
  });

  it("surfaces Cloudflare's error message with the prefix capture treats as final", async () => {
    stubFetch(() => Response.json({ success: false, errors: [{ code: 7003, message: "Navigation timeout" }] }, { status: 422 }));

    await expect(captureWithCloudflare(config, { url: "https://example.com/" }))
      .rejects.toThrow("Screenshot capture failed (Cloudflare) (HTTP 422): Navigation timeout");
  });

  it("rejects a 200 that carries a JSON envelope instead of an image", async () => {
    stubFetch(() => Response.json({ success: false, errors: [{ code: 1, message: "quota exceeded" }] }));

    await expect(captureWithCloudflare(config, { url: "https://example.com/" }))
      .rejects.toThrow("quota exceeded");
  });

  it("refuses an invalid URL without calling Cloudflare", async () => {
    const calls = stubFetch(() => new Response(""));

    await expect(captureWithCloudflare(config, { url: "not a url" })).rejects.toThrow("Invalid URL");
    expect(calls).toHaveLength(0);
  });
});

describe("withCaptureSlot", () => {
  it("runs captures one at a time, in arrival order", async () => {
    let running = 0;
    let maxRunning = 0;
    const order: number[] = [];

    await Promise.all([1, 2, 3].map((n) => withCaptureSlot(async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 5));
      order.push(n);
      running -= 1;
    })));

    expect(maxRunning).toBe(1);
    expect(order).toEqual([1, 2, 3]);
  });

  it("releases the slot when a capture throws", async () => {
    await expect(withCaptureSlot(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await withCaptureSlot(async () => "next")).toBe("next");
  });

  it("refuses with a pool-exhausted error once the wait list is full", async () => {
    let release!: () => void;
    const blocker = withCaptureSlot(() => new Promise<void>((r) => { release = r; }));
    const queued = Array.from({ length: 20 }, () => withCaptureSlot(async () => {}));

    await expect(withCaptureSlot(async () => {})).rejects.toThrow("pool exhausted");

    release();
    await Promise.all([blocker, ...queued]);
  });
});
