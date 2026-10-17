import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { api, seedUser, seedWebsite, sql } from "./harness";
import { agencyApi, fileUnderClient, seedClient, seedEvents, seedHeatmapClick, seedReplay } from "./helpers/identity";

// Links are made through the agency workspace (agency-workspace.integration.ts covers its rules).
const E = "/api/v1/embed";

async function siteLink(sections?: string[]) {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  const res = await agencyApi("POST", "/embeds", owner.id, { scope: "website", target_id: site.id, ...(sections ? { sections } : {}) });
  expect(res.status).toBe(201);
  return { owner, site, link: res.body.data, tok: { "X-Embed-Token": res.body.data.token } };
}

describe("the embed API", () => {
  it("reads the target site's info and analytics with the header or the query token", async () => {
    const { site, link, tok } = await siteLink();
    await seedEvents(site.id, ["/a", "/a"]);

    const info = await api("GET", `${E}/${site.id}/info`, { query: { token: link.token } });
    expect(info.status).toBe(200);
    expect(info.body.data).toMatchObject({ website: { name: "Test site", url: `https://${site.domain}` }, sections: ["analytics"] });
    expect(info.body.data.brand).toMatchObject({ brand_name: "", hide_seentics: false });

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

    await agencyApi("PATCH", `/embeds/${link.id}`, owner.id, { sections: ["recordings", "heatmaps"] });
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
    const res = await agencyApi("POST", "/embeds", owner.id, { scope: "client", target_id: clientId });
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
