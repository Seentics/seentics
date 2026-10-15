import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";
import { fileUnderClient, seedClient, seedEvents, seedHeatmapClick, seedReplay } from "./helpers/identity";

const L = "/api/v1/user/agency/embed-links";
const E = "/api/v1/embed";

async function siteLink(sections?: string[]) {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  const res = await api("POST", L, { token: owner.token, body: sections ? { website_id: site.id, sections } : { website_id: site.id } });
  expect(res.status).toBe(201);
  return { owner, site, link: res.body.data, tok: { "X-Embed-Token": res.body.data.token } };
}

describe("embed links from the dashboard", () => {
  it("makes a website's link once, lists it, and exposes only analytics by default", async () => {
    const { owner, site, link } = await siteLink();
    expect(link).toMatchObject({ scope: "website", target_id: site.id, target_name: "Test site", sections: ["analytics"] });
    expect(link.embed_url).toContain(`/embed/${site.id}?token=${link.token}`);

    const again = await api("POST", L, { token: owner.token, body: { website_id: site.id } });
    expect(again.status).toBe(200);
    expect(again.body.data.id).toBe(link.id);

    const list = await api("GET", L, { token: owner.token });
    expect(list.body.data.map((l: { id: string }) => l.id)).toEqual([link.id]);
  });

  it("lets a site admin make the link, files it under the owner, and refuses members and viewers", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const [admin, member, viewer] = [await seedUser(), await seedUser(), await seedUser()];
    await addMember(site.id, admin.id, "admin");
    await addMember(site.id, member.id, "member");
    await addMember(site.id, viewer.id, "viewer");

    for (const u of [member, viewer]) {
      expect((await api("POST", L, { token: u.token, body: { website_id: site.id } })).status).toBe(403);
    }
    expect(await sql`SELECT 1 FROM embed_links WHERE website_id = ${site.id}::uuid`).toHaveLength(0);

    const made = await api("POST", L, { token: admin.token, body: { website_id: site.id } });
    expect(made.status).toBe(201);
    const [row] = await sql<{ owner_id: string }[]>`SELECT owner_id::text FROM embed_links WHERE id = ${made.body.data.id}::uuid`;
    expect(row!.owner_id).toBe(owner.id);
  });

  it("refuses a stranger's site or client, and bad bodies", async () => {
    const victim = await seedUser();
    const site = await seedWebsite(victim.id);
    const clientId = await seedClient(victim.id);
    const me = await seedUser();

    expect((await api("POST", L, { token: me.token, body: { website_id: site.id } })).status).toBe(403);
    expect((await api("POST", L, { token: me.token, body: { client_id: clientId } })).status).toBe(403);
    for (const body of [{}, { website_id: "nope" }, { website_id: site.id, client_id: clientId }, { website_id: site.id, sections: [] }, { website_id: site.id, sections: ["secrets"] }]) {
      expect((await api("POST", L, { token: me.token, body })).status).toBe(400);
    }
    expect((await api("POST", L, { body: { website_id: site.id } })).status).toBe(401);
    expect((await api("GET", L)).status).toBe(401);
  });

  it("changes sections only for someone who may share the target", async () => {
    const { owner, link } = await siteLink();
    const stranger = await seedUser();

    expect((await api("PATCH", `${L}/${link.id}`, { token: stranger.token, body: { sections: ["recordings"] } })).status).toBe(404);
    const res = await api("PATCH", `${L}/${link.id}`, { token: owner.token, body: { sections: ["recordings", "analytics", "recordings"] } });
    expect(res.status).toBe(200);
    expect(res.body.data.sections).toEqual(["analytics", "recordings"]);
    expect((await api("PATCH", `${L}/${link.id}`, { token: owner.token, body: { sections: [] } })).status).toBe(400);
  });

  it("revokes for the owner only; the token stops at once and a new link gets a new URL", async () => {
    const { owner, site, link, tok } = await siteLink();
    const stranger = await seedUser();
    expect((await api("GET", `${E}/${site.id}/info`, { headers: tok })).status).toBe(200);

    expect((await api("DELETE", `${L}/${link.id}`, { token: stranger.token })).status).toBe(404);
    expect((await api("GET", `${E}/${site.id}/info`, { headers: tok })).status).toBe(200);

    expect((await api("DELETE", `${L}/${link.id}`, { token: owner.token })).status).toBe(204);
    expect((await api("GET", `${E}/${site.id}/info`, { headers: tok })).status).toBe(401);
    expect((await api("DELETE", `${L}/${link.id}`, { token: owner.token })).status).toBe(404);
    expect((await api("GET", L, { token: owner.token })).body.data).toEqual([]);

    const fresh = await api("POST", L, { token: owner.token, body: { website_id: site.id } });
    expect(fresh.status).toBe(201);
    expect(fresh.body.data.token).not.toBe(link.token);
  });

  it("answers a malformed link id as not found", async () => {
    const owner = await seedUser();
    expect((await api("DELETE", `${L}/not-a-uuid`, { token: owner.token })).status).toBe(404);
    expect((await api("PATCH", `${L}/not-a-uuid`, { token: owner.token, body: { sections: ["analytics"] } })).status).toBe(404);
  });
});

describe("the embed API", () => {
  it("reads the target site's info and analytics with the header or the query token", async () => {
    const { site, link, tok } = await siteLink();
    await seedEvents(site.id, ["/a", "/a"]);

    const info = await api("GET", `${E}/${site.id}/info`, { query: { token: link.token } });
    expect(info.status).toBe(200);
    expect(info.body.data).toEqual({ website: { name: "Test site", url: `https://${site.domain}` }, sections: ["analytics"] });

    const pages = await api("GET", `${E}/${site.id}/analytics/top-pages`, { headers: tok, query: { days: 7 } });
    expect(pages.status).toBe(200);
    expect(pages.body.top_pages).toEqual([{ page: "/a", views: 2, unique: 1 }]);
    expect(pages.headers.get("Cache-Control")).toBe("private, max-age=60");
  });

  it("refuses the token on any other site, even one of the same owner", async () => {
    const { owner, tok } = await siteLink();
    const sibling = await seedWebsite(owner.id);
    const stranger = await seedWebsite((await seedUser()).id);
    for (const id of [sibling.id, stranger.id, randomUUID()]) {
      const res = await api("GET", `${E}/${id}/analytics/traffic-summary`, { headers: tok });
      expect({ id, status: res.status }).toEqual({ id, status: 401 });
    }
    // A malformed id never reaches a read; it is refused one way or the other.
    expect([401, 404]).toContain((await api("GET", `${E}/not-a-uuid/analytics/traffic-summary`, { headers: tok })).status);
  });

  it("refuses a missing, forged or session token with one answer", async () => {
    const { owner, site } = await siteLink();
    const a = await api("GET", `${E}/${site.id}/info`);
    for (const t of ["garbage", owner.token, owner.refreshToken]) {
      const res = await api("GET", `${E}/${site.id}/info`, { headers: { "X-Embed-Token": t } });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(a.body);
    }
    expect(a.body.code).toBe("invalid_embed_token");
  });

  it("is not accepted as a dashboard session", async () => {
    const { link } = await siteLink();
    expect((await api("GET", "/api/v1/user/auth/me", { token: link.token })).status).toBe(401);
  });

  it("refuses sections the link does not expose, and allows them once added", async () => {
    const { owner, site, link, tok } = await siteLink(["analytics"]);
    await seedReplay(site.id);
    await seedHeatmapClick(site.id, "/");

    const replays = await api("GET", `${E}/${site.id}/replays`, { headers: tok });
    expect(replays.status).toBe(403);
    expect(replays.body.code).toBe("embed_section_disabled");
    expect((await api("GET", `${E}/${site.id}/heatmaps/pages`, { headers: tok })).status).toBe(403);

    await api("PATCH", `${L}/${link.id}`, { token: owner.token, body: { sections: ["recordings", "heatmaps"] } });
    expect((await api("GET", `${E}/${site.id}/replays`, { headers: tok })).status).toBe(200);
    expect((await api("GET", `${E}/${site.id}/heatmaps/pages`, { headers: tok })).status).toBe(200);
    // Analytics was dropped from the link, and that applies at once too.
    expect((await api("GET", `${E}/${site.id}/analytics/top-pages`, { headers: tok })).status).toBe(403);
  });

  it("checks the token before the section, so a bad token learns nothing", async () => {
    const { site } = await siteLink(["analytics"]);
    expect((await api("GET", `${E}/${site.id}/replays`, { headers: { "X-Embed-Token": "x" } })).status).toBe(401);
  });

  it("serves only the dashboard's read endpoints", async () => {
    const { site, tok } = await siteLink();
    expect((await api("GET", `${E}/${site.id}/analytics/export`, { headers: tok })).status).toBe(404);
    expect((await api("DELETE", `${E}/${site.id}/replays`, { headers: tok })).status).toBe(404);
  });
});

describe("client embed links", () => {
  async function clientLink(status = "active") {
    const owner = await seedUser();
    const clientId = await seedClient(owner.id, { name: "Client Co", status });
    const inside = await seedWebsite(owner.id);
    const outside = await seedWebsite(owner.id);
    await fileUnderClient(inside.id, clientId);
    const res = await api("POST", L, { token: owner.token, body: { client_id: clientId } });
    expect(res.status).toBe(201);
    return { owner, clientId, inside, outside, link: res.body.data, tok: { "X-Embed-Token": res.body.data.token } };
  }

  it("lists the client's sites and reads them, but no site outside the client", async () => {
    const { clientId, inside, outside, tok } = await clientLink();
    const list = await api("GET", `${E}/client/${clientId}/websites`, { headers: tok });
    expect(list.status).toBe(200);
    expect(list.body.data.client.name).toBe("Client Co");
    expect(list.body.data.websites.map((w: { id: string }) => w.id)).toEqual([inside.id]);

    expect((await api("GET", `${E}/${inside.id}/info`, { headers: tok })).status).toBe(200);
    expect((await api("GET", `${E}/${outside.id}/info`, { headers: tok })).status).toBe(401);
  });

  it("stops covering a site moved out of the client", async () => {
    const { inside, tok } = await clientLink();
    await sql`UPDATE websites SET client_id = NULL WHERE id = ${inside.id}::uuid`;
    expect((await api("GET", `${E}/${inside.id}/info`, { headers: tok })).status).toBe(401);
  });

  it("is refused while the client is suspended", async () => {
    const { clientId, inside, tok } = await clientLink("suspended");
    expect((await api("GET", `${E}/client/${clientId}/websites`, { headers: tok })).status).toBe(401);
    expect((await api("GET", `${E}/${inside.id}/info`, { headers: tok })).status).toBe(401);
  });

  it("does not let a website token list a client, nor a client token another client", async () => {
    const a = await clientLink();
    const b = await clientLink();
    expect((await api("GET", `${E}/client/${b.clientId}/websites`, { headers: a.tok })).status).toBe(401);
    const siteTok = await siteLink();
    expect((await api("GET", `${E}/client/${a.clientId}/websites`, { headers: siteTok.tok })).status).toBe(401);
  });
});
