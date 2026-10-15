import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { pinnedFetch } from "../pinned-fetch";
import { NonPublicHostError } from "../public-host";

let server: ReturnType<typeof Bun.serve>;
const seen: Array<{ method: string; host: string | null; body: string; key: string | null }> = [];

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      const u = new URL(req.url);
      seen.push({ method: req.method, host: req.headers.get("host"), body: await req.text(), key: req.headers.get("x-api-key") });
      if (u.pathname === "/redirect") return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } });
      if (u.pathname === "/big") return new Response("x".repeat(100_000));
      return Response.json({ ok: true }, { status: 201 });
    },
  });
});
afterAll(() => server.stop(true));

// The test server is on 127.0.0.1, which production refuses; these tests let it through.
const allowLocal = { isBlocked: () => false };

describe("pinnedFetch", () => {
  it("connects to the address it checked, keeping the hostname for Host", async () => {
    const res = await pinnedFetch(`http://hooks.example.test:${server.port}/hook`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": "k" }, body: '{"a":1}',
    }, { ...allowLocal, lookup: async () => ["127.0.0.1"] });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(seen.at(-1)).toEqual({ method: "POST", host: `hooks.example.test:${server.port}`, body: '{"a":1}', key: "k" });
  });

  it("refuses a name that resolves to any private address, before connecting", async () => {
    const before = seen.length;
    for (const answers of [["127.0.0.1"], ["10.0.0.5"], ["169.254.169.254"], ["93.184.216.34", "192.168.1.1"], []]) {
      await expect(pinnedFetch(`http://rebind.example.test:${server.port}/`, {}, { lookup: async () => answers })).rejects.toBeInstanceOf(NonPublicHostError);
    }
    await expect(pinnedFetch(`http://127.0.0.1:${server.port}/`)).rejects.toBeInstanceOf(NonPublicHostError);
    await expect(pinnedFetch("http://[::ffff:7f00:1]/")).rejects.toBeInstanceOf(NonPublicHostError);
    expect(seen.length).toBe(before);
  });

  it("returns a redirect instead of following it", async () => {
    const res = await pinnedFetch(`http://127.0.0.1:${server.port}/redirect`, {}, allowLocal);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://169.254.169.254/");
  });

  it("stops reading past maxBytes, and honours a timeout", async () => {
    const res = await pinnedFetch(`http://127.0.0.1:${server.port}/big`, {}, { ...allowLocal, maxBytes: 10_000 });
    expect((await res.text()).length).toBeLessThanOrEqual(10_000 + 65_536);
    const err = await pinnedFetch("http://10.255.255.1/", { signal: AbortSignal.timeout(1) }, { isBlocked: () => false }).catch((e) => e);
    expect(err).toBeTruthy();
  });

  it("refuses a protocol other than http and https", async () => {
    await expect(pinnedFetch("file:///etc/passwd")).rejects.toThrow("unsupported protocol");
  });
});
