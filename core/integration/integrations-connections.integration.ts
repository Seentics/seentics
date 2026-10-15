// Must load first: replaces outbound HTTP and DNS before the app is composed.
import { PRIVATE_HOST, dns, hookUrl, receiver } from "./helpers/integrations";
import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";

async function ownerWithSite() {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  return { owner, site };
}

/** Connect a Zapier webhook through the API; the receiver answers its verification call with 200. */
async function connectZapier(token: string, websiteId: string, extra: Record<string, unknown> = {}) {
  const hook = hookUrl();
  const res = await api("POST", `/api/v1/integrations/${websiteId}/connections`, {
    token,
    body: { provider: "zapier", name: "My Zap", credentials: { webhook_url: hook.url, ...extra } },
  });
  return { res, hook, id: res.body?.data?.id as string };
}

describe("listing destinations", () => {
  it("shows the provider catalogue and the site's connections to the owner", async () => {
    const { owner, site } = await ownerWithSite();
    await connectZapier(owner.token, site.id);

    const res = await api("GET", `/api/v1/integrations/${site.id}`, { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.data.providers.map((p: { id: string }) => p.id)).toEqual(["zapier", "mailchimp", "klaviyo", "hubspot"]);
    expect(res.body.data.connections).toHaveLength(1);
    expect(res.body.data.connections[0]).toMatchObject({ provider: "zapier", name: "My Zap", enabled: true, status: "active", pending_count: 0 });
  });

  it("requires a session", async () => {
    const { site } = await ownerWithSite();
    expect((await api("GET", `/api/v1/integrations/${site.id}`)).status).toBe(401);
  });

  it("refuses another account's site", async () => {
    const { site } = await ownerWithSite();
    const stranger = await seedUser();
    expect((await api("GET", `/api/v1/integrations/${site.id}`, { token: stranger.token })).status).toBe(403);
  });

  it("lets a viewer read", async () => {
    const { site } = await ownerWithSite();
    const viewer = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    expect((await api("GET", `/api/v1/integrations/${site.id}`, { token: viewer.token })).status).toBe(200);
  });
});

describe("connecting a destination", () => {
  it("proves the webhook with a test lead, stores the URL sealed, and returns only a hint", async () => {
    const { owner, site } = await ownerWithSite();

    const { res, hook, id } = await connectZapier(owner.token, site.id, { signing_secret: "shh-very-secret-value" });

    expect(res.status).toBe(201);
    // The URL is the secret (anyone holding it can trigger the Zap): it must never come back.
    expect(res.text).not.toContain(hook.marker);
    expect(res.text).not.toContain("shh-very-secret-value");
    expect(res.body.data.credentials_hint).toBe(hook.marker.slice(-4));
    const sent = receiver.to(hook.marker);
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]!.body)).toMatchObject({ event: "lead.test", test: true });
    expect(sent[0]!.headers["x-seentics-signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);

    const [row] = await sql<{ credentials: string; credentials_hint: string }[]>`
      SELECT credentials, credentials_hint FROM integration_connections WHERE id = ${id}::uuid`;
    expect(row!.credentials).toMatch(/^v1\./);
    expect(row!.credentials).not.toContain(hook.marker);
    expect(row!.credentials).not.toContain("shh-very-secret-value");
  });

  it("lets a member connect but not a viewer, and nobody from another account", async () => {
    const { site } = await ownerWithSite();
    const member = await seedUser();
    const viewer = await seedUser();
    const stranger = await seedUser();
    await addMember(site.id, member.id, "member");
    await addMember(site.id, viewer.id, "viewer");

    expect((await connectZapier(viewer.token, site.id)).res.status).toBe(403);
    expect((await connectZapier(stranger.token, site.id)).res.status).toBe(403);
    expect((await api("POST", `/api/v1/integrations/${site.id}/connections`, { body: {} })).status).toBe(401);
    expect((await connectZapier(member.token, site.id)).res.status).toBe(201);
    expect(await sql`SELECT 1 FROM integration_connections WHERE website_id = ${site.id}::uuid`).toHaveLength(1);
  });

  it("rejects malformed requests before calling anyone", async () => {
    const { owner, site } = await ownerWithSite();
    const path = `/api/v1/integrations/${site.id}/connections`;
    const before = receiver.requests.length;

    for (const body of [
      "not json",
      { provider: "salesforce", credentials: {} },
      { provider: "zapier" },
      { provider: "zapier", credentials: "https://x" },
    ]) {
      expect((await api("POST", path, { token: owner.token, body })).status).toBe(400);
    }
    // Provider-level validation: Zapier only takes an https URL.
    const plain = await api("POST", path, { token: owner.token, body: { provider: "zapier", credentials: { webhook_url: "http://hooks.receiver.example/x" } } });
    expect(plain.status).toBe(400);
    expect(plain.body.error).toBe("invalid");

    expect(receiver.requests.length).toBe(before);
    expect(await sql`SELECT 1 FROM integration_connections WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });

  it("refuses a webhook that points at a private network, without sending to it", async () => {
    const { owner, site } = await ownerWithSite();
    const path = `/api/v1/integrations/${site.id}/connections`;

    for (const url of [`https://${PRIVATE_HOST}/hooks/a`, "https://localhost/hooks/a", "https://127.0.0.1/hooks/a", "https://nowhere.receiver.example/x"]) {
      const res = await api("POST", path, { token: owner.token, body: { provider: "zapier", credentials: { webhook_url: url } } });
      expect({ url, status: res.status }).toEqual({ url, status: 502 });
    }
    expect(receiver.requests.some((r) => r.url.includes(PRIVATE_HOST) || r.url.includes("localhost") || r.url.includes("127.0.0.1"))).toBe(false);
    expect(await sql`SELECT 1 FROM integration_connections WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });

  it("reports a refused credential as 422, with the secret redacted from the message", async () => {
    const { owner, site } = await ownerWithSite();
    const hook = hookUrl();
    // Provider error bodies can echo the request back.
    receiver.replies.set(hook.marker, { status: 401, body: JSON.stringify({ message: `bad hook ${hook.url}` }) });

    const res = await api("POST", `/api/v1/integrations/${site.id}/connections`, {
      token: owner.token, body: { provider: "zapier", credentials: { webhook_url: hook.url } },
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("rejected");
    expect(res.text).not.toContain(hook.marker);
    expect(res.body.message).toContain("[redacted]");
    expect(await sql`SELECT 1 FROM integration_connections WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });

  it("reports a provider outage as 502 and stores nothing", async () => {
    const { owner, site } = await ownerWithSite();
    const hook = hookUrl();
    receiver.replies.set(hook.marker, { status: 503 });

    const res = await api("POST", `/api/v1/integrations/${site.id}/connections`, {
      token: owner.token, body: { provider: "zapier", credentials: { webhook_url: hook.url } },
    });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe("unavailable");
    expect(await sql`SELECT 1 FROM integration_connections WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });

  it("caps a site at ten destinations", async () => {
    const { owner, site } = await ownerWithSite();
    for (let i = 0; i < 10; i++) {
      await sql`INSERT INTO integration_connections (website_id, provider, credentials) VALUES (${site.id}::uuid, 'zapier', 'sealed')`;
    }

    const { res } = await connectZapier(owner.token, site.id);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("connection_limit");
  });

  it("meters calls to third parties per site", async () => {
    const { owner, site } = await ownerWithSite();
    const body = { provider: "zapier", credentials: { webhook_url: `https://${PRIVATE_HOST}/x` } };
    for (let i = 0; i < 10; i++) {
      await api("POST", `/api/v1/integrations/${site.id}/connections`, { token: owner.token, body });
    }

    const res = await api("POST", `/api/v1/integrations/${site.id}/connections`, { token: owner.token, body });

    expect(res.status).toBe(429);
    // Another site's budget is its own.
    const other = await seedWebsite(owner.id);
    expect((await connectZapier(owner.token, other.id)).res.status).toBe(201);
  });
});

describe("changing a destination", () => {
  it("renames and switches off without calling the provider again", async () => {
    const { owner, site } = await ownerWithSite();
    const { id, hook } = await connectZapier(owner.token, site.id);

    const res = await api("PATCH", `/api/v1/integrations/${site.id}/connections/${id}`, { token: owner.token, body: { name: "Renamed", enabled: false } });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "Renamed", enabled: false });
    expect(receiver.to(hook.marker)).toHaveLength(1);
  });

  it("re-proves new credentials and replaces the sealed value and hint", async () => {
    const { owner, site } = await ownerWithSite();
    const { id } = await connectZapier(owner.token, site.id);
    const [before] = await sql<{ credentials: string }[]>`SELECT credentials FROM integration_connections WHERE id = ${id}::uuid`;
    const next = hookUrl();

    const res = await api("PATCH", `/api/v1/integrations/${site.id}/connections/${id}`, { token: owner.token, body: { credentials: { webhook_url: next.url } } });

    expect(res.status).toBe(200);
    expect(res.body.data.credentials_hint).toBe(next.marker.slice(-4));
    expect(res.text).not.toContain(next.marker);
    expect(receiver.to(next.marker)).toHaveLength(1);
    const [after] = await sql<{ credentials: string }[]>`SELECT credentials FROM integration_connections WHERE id = ${id}::uuid`;
    expect(after!.credentials).not.toBe(before!.credentials);
  });

  it("keeps the old credentials when the new ones are refused", async () => {
    const { owner, site } = await ownerWithSite();
    const { id } = await connectZapier(owner.token, site.id);
    const [before] = await sql<{ credentials: string }[]>`SELECT credentials FROM integration_connections WHERE id = ${id}::uuid`;

    const res = await api("PATCH", `/api/v1/integrations/${site.id}/connections/${id}`, {
      token: owner.token, body: { credentials: { webhook_url: `https://${PRIVATE_HOST}/x` } },
    });

    expect(res.status).toBe(502);
    const [after] = await sql<{ credentials: string }[]>`SELECT credentials FROM integration_connections WHERE id = ${id}::uuid`;
    expect(after!.credentials).toBe(before!.credentials);
  });

  it("clears the failure state when switched back on", async () => {
    const { owner, site } = await ownerWithSite();
    const { id } = await connectZapier(owner.token, site.id);
    await sql`UPDATE integration_connections SET enabled = false, status = 'error', consecutive_failures = 5, last_error = 'HTTP 401'
              WHERE id = ${id}::uuid`;

    const res = await api("PATCH", `/api/v1/integrations/${site.id}/connections/${id}`, { token: owner.token, body: { enabled: true } });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ enabled: true, status: "active", consecutive_failures: 0, last_error: null });
  });

  it("validates the request and the target", async () => {
    const { owner, site } = await ownerWithSite();
    const { id } = await connectZapier(owner.token, site.id);
    const other = await ownerWithSite();
    const theirs = await connectZapier(other.owner.token, other.site.id);
    const base = `/api/v1/integrations/${site.id}/connections`;

    expect((await api("PATCH", `${base}/${id}`, { token: owner.token, body: {} })).status).toBe(400);
    expect((await api("PATCH", `${base}/not-a-uuid`, { token: owner.token, body: { name: "x" } })).status).toBe(404);
    expect((await api("PATCH", `${base}/${randomUUID()}`, { token: owner.token, body: { name: "x" } })).status).toBe(404);
    // Another site's connection id, addressed through a site the caller owns.
    expect((await api("PATCH", `${base}/${theirs.id}`, { token: owner.token, body: { name: "hijack" } })).status).toBe(404);
    const [row] = await sql<{ name: string }[]>`SELECT name FROM integration_connections WHERE id = ${theirs.id}::uuid`;
    expect(row!.name).toBe("My Zap");
  });

  it("is refused to a viewer", async () => {
    const { owner, site } = await ownerWithSite();
    const { id } = await connectZapier(owner.token, site.id);
    const viewer = await seedUser();
    await addMember(site.id, viewer.id, "viewer");

    const res = await api("PATCH", `/api/v1/integrations/${site.id}/connections/${id}`, { token: viewer.token, body: { enabled: false } });

    expect(res.status).toBe(403);
    const [row] = await sql<{ enabled: boolean }[]>`SELECT enabled FROM integration_connections WHERE id = ${id}::uuid`;
    expect(row!.enabled).toBe(true);
  });
});

describe("removing a destination", () => {
  it("deletes it, then reports it gone", async () => {
    const { owner, site } = await ownerWithSite();
    const { id } = await connectZapier(owner.token, site.id);
    const path = `/api/v1/integrations/${site.id}/connections/${id}`;

    expect((await api("DELETE", path, { token: owner.token })).status).toBe(200);
    expect(await sql`SELECT 1 FROM integration_connections WHERE id = ${id}::uuid`).toHaveLength(0);
    expect((await api("DELETE", path, { token: owner.token })).status).toBe(404);
  });

  it("is refused to a viewer and cannot reach another site's destination", async () => {
    const { owner, site } = await ownerWithSite();
    const { id } = await connectZapier(owner.token, site.id);
    const viewer = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    const other = await ownerWithSite();

    expect((await api("DELETE", `/api/v1/integrations/${site.id}/connections/${id}`, { token: viewer.token })).status).toBe(403);
    expect((await api("DELETE", `/api/v1/integrations/${other.site.id}/connections/${id}`, { token: other.owner.token })).status).toBe(404);
    expect(await sql`SELECT 1 FROM integration_connections WHERE id = ${id}::uuid`).toHaveLength(1);
  });
});

describe("sending a test lead", () => {
  it("sends a marked sample through the destination and reports the outcome", async () => {
    const { owner, site } = await ownerWithSite();
    const { id, hook } = await connectZapier(owner.token, site.id);

    const res = await api("POST", `/api/v1/integrations/${site.id}/connections/${id}/test`, { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ kind: "ok", httpStatus: 200 });
    const sent = receiver.to(hook.marker);
    expect(sent).toHaveLength(2);
    expect(JSON.parse(sent[1]!.body)).toMatchObject({ event: "lead.test", email: "seentics-test@example.com" });
    // Outside the queue: no delivery row.
    expect(await sql`SELECT 1 FROM integration_deliveries WHERE connection_id = ${id}::uuid`).toHaveLength(0);
  });

  it("returns a failing destination's outcome rather than an error", async () => {
    const { owner, site } = await ownerWithSite();
    const { id, hook } = await connectZapier(owner.token, site.id);
    receiver.replies.set(hook.marker, { status: 500, body: "boom" });

    const res = await api("POST", `/api/v1/integrations/${site.id}/connections/${id}/test`, { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ kind: "failed", retryable: true, httpStatus: 500 });
  });

  it("refuses when the destination's host now resolves privately (DNS rebinding)", async () => {
    const { owner, site } = await ownerWithSite();
    const host = `rebind-${randomUUID().slice(0, 8)}.receiver.example`;
    dns.set(host, ["93.184.216.34"]);
    const hook = hookUrl(host);
    const res0 = await api("POST", `/api/v1/integrations/${site.id}/connections`, {
      token: owner.token, body: { provider: "zapier", credentials: { webhook_url: hook.url } },
    });
    expect(res0.status).toBe(201);
    dns.set(host, ["169.254.169.254"]);

    const res = await api("POST", `/api/v1/integrations/${site.id}/connections/${res0.body.data.id}/test`, { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.data.kind).toBe("failed");
    expect(receiver.to(hook.marker)).toHaveLength(1);
  });

  it("will not open credentials copied from another destination's row", async () => {
    // The ciphertext is bound to its website and connection id.
    const { owner, site } = await ownerWithSite();
    const a = await connectZapier(owner.token, site.id);
    const other = await ownerWithSite();
    const b = await connectZapier(other.owner.token, other.site.id);
    await sql`UPDATE integration_connections SET credentials = (SELECT credentials FROM integration_connections WHERE id = ${b.id}::uuid)
              WHERE id = ${a.id}::uuid`;

    const res = await api("POST", `/api/v1/integrations/${site.id}/connections/${a.id}/test`, { token: owner.token });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe("unavailable");
    expect(receiver.to(b.hook.marker)).toHaveLength(1);
  });

  it("is refused to a viewer and 404s an unknown destination", async () => {
    const { owner, site } = await ownerWithSite();
    const { id } = await connectZapier(owner.token, site.id);
    const viewer = await seedUser();
    await addMember(site.id, viewer.id, "viewer");

    expect((await api("POST", `/api/v1/integrations/${site.id}/connections/${id}/test`, { token: viewer.token })).status).toBe(403);
    expect((await api("POST", `/api/v1/integrations/${site.id}/connections/${randomUUID()}/test`, { token: owner.token })).status).toBe(404);
    expect((await api("POST", `/api/v1/integrations/${site.id}/connections/nope/test`, { token: owner.token })).status).toBe(404);
  });
});
