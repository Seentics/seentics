import { describe, it, expect, beforeEach } from "bun:test";
import { ProposalApplier, type ProposalWriters } from "../services/agent/proposal-applier";
import type { AiRepository } from "../interfaces/ai-repository.interface";
import type { WebsiteRole } from "../../websites/interfaces";

const USER = "user-1";
const SITE = "11111111-1111-4111-8111-111111111111";
const OTHER_SITE = "22222222-2222-4222-8222-222222222222";
const QUERY = "query-1";
const AUTOMATION = "33333333-3333-4333-8333-333333333333";
const V1 = "2026-10-01T10:00:00.000Z";
const V2 = "2026-10-02T10:00:00.000Z";

const DRAFT = {
  resource: "automation",
  operation: "create",
  payload: { name: "Exit offer", status: "draft" },
};

class FakeRepo {
  stored: { websiteId: string; proposal: Record<string, unknown> } | null = {
    websiteId: SITE, proposal: { ...DRAFT },
  };
  applied = false;
  claims = 0;
  releases = 0;

  async pendingProposal() {
    // Mirrors the real query: an applied draft is not pending.
    return this.applied ? null : this.stored;
  }

  async markProposalApplied() {
    this.claims++;
    if (this.applied) return false;
    this.applied = true;
    return true;
  }

  async releaseProposalClaim() {
    this.releases++;
    this.applied = false;
  }
}

/** An automation store keyed by site: what the real port's website-scoped lookup gives. */
class FakeAutomations {
  rows = new Map<string, { websiteId: string; version: string; active: boolean; name: string }>([
    [AUTOMATION, { websiteId: SITE, version: V1, active: false, name: "Exit offer" }],
  ]);
  writes: unknown[] = [];
  deletes = 0;
  failNext = false;

  writer() {
    const self = this;
    return {
      async create(input: unknown) { self.writes.push(["create", input]); return { id: "automation-1" }; },
      async version(websiteId: string, id: string) {
        const row = self.rows.get(id);
        return row && row.websiteId === websiteId ? row.version : null;
      },
      async update(input: { id: string; payload: unknown }) {
        if (self.failNext) { self.failNext = false; throw new Error("database unavailable"); }
        self.writes.push(["update", input]);
        return { id: input.id };
      },
      async setStatus(input: { id: string; payload: unknown }) {
        self.writes.push(["setStatus", input]);
        self.rows.get(input.id)!.active = (input.payload as { active: boolean }).active;
        return { id: input.id };
      },
    };
  }
}

let repo: FakeRepo;
let automations: FakeAutomations;
let settingsWrites: unknown[];
let applier: ProposalApplier;

function writers(): ProposalWriters {
  return {
    automation: automations.writer(),
    site_settings: {
      version: async (websiteId, id) => (id === websiteId ? V1 : null),
      update: async (input) => { settingsWrites.push(input); return { id: input.websiteId }; },
    },
    goal: {
      create: async () => ({ id: "goal-1" }),
      version: async () => V1,
      update: async (input) => ({ id: input.id }),
    },
  };
}

beforeEach(() => {
  repo = new FakeRepo();
  automations = new FakeAutomations();
  settingsWrites = [];
  applier = new ProposalApplier(repo as unknown as AiRepository, writers());
});

const apply = (over: Partial<{ userId: string; websiteId: string; queryId: string; role: WebsiteRole; can: (p: string) => boolean }> = {}) =>
  applier.apply({ userId: USER, websiteId: SITE, queryId: QUERY, role: "member", ...over });

const change = (over: Record<string, unknown> = {}) => ({
  resource: "automation",
  operation: "update",
  target: { id: AUTOMATION, version: V1 },
  payload: { name: "Renamed" },
  ...over,
});

describe("ProposalApplier — create", () => {
  it("creates the resource the stored draft describes", async () => {
    const r = await apply();
    expect(r).toEqual({ ok: true, created: { resource: "automation", id: "automation-1" }, operation: "create" });
    expect(automations.writes).toHaveLength(1);
  });

  it("treats a stored draft without an operation as a create (drafts from before operations)", async () => {
    repo.stored = { websiteId: SITE, proposal: { resource: "automation", payload: {} } };
    expect((await apply()).ok).toBe(true);
  });

  it("passes the stored payload, not one from the request", async () => {
    // The whole point of the confirmation screen: what was shown is what gets created.
    await apply();
    expect((automations.writes[0] as any)[1].payload).toEqual({ name: "Exit offer", status: "draft" });
  });

  it("refuses a draft belonging to another website", async () => {
    const r = await apply({ websiteId: OTHER_SITE });
    expect(r.ok).toBe(false);
    expect(automations.writes).toHaveLength(0);
  });

  it("refuses when there is no pending draft", async () => {
    repo.stored = null;
    const r = await apply();
    expect(r.ok).toBe(false);
    expect(automations.writes).toHaveLength(0);
  });

  it("creates once when confirmed twice", async () => {
    // Double-click, retry, two tabs. The second confirm must not produce a second
    // automation on the customer's live site.
    const first = await apply();
    const second = await apply();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(automations.writes).toHaveLength(1);
  });

  it("claims the draft before writing, not after", async () => {
    let claimedBeforeWrite = false;
    const ordered = new ProposalApplier(repo as unknown as AiRepository, {
      automation: {
        async create() {
          claimedBeforeWrite = repo.applied;
          return { id: "automation-1" };
        },
      },
    });
    await ordered.apply({ userId: USER, websiteId: SITE, queryId: QUERY, role: "member" });
    expect(claimedBeforeWrite).toBe(true);
  });

  it("releases the claim when the write fails, so it can be confirmed again", async () => {
    let attempts = 0;
    const flaky = new ProposalApplier(repo as unknown as AiRepository, {
      automation: {
        async create() {
          attempts++;
          if (attempts === 1) throw new Error("database unavailable");
          return { id: "automation-1" };
        },
      },
    });
    const first = await flaky.apply({ userId: USER, websiteId: SITE, queryId: QUERY, role: "member" });
    expect(first).toEqual({ ok: false, error: "database unavailable" });
    expect(repo.applied).toBe(false);
    expect(repo.releases).toBe(1);
    const retry = await flaky.apply({ userId: USER, websiteId: SITE, queryId: QUERY, role: "member" });
    expect(retry.ok).toBe(true);
  });

  it("refuses an operation it does not implement", async () => {
    repo.stored = { websiteId: SITE, proposal: { ...DRAFT, operation: "delete" } };
    expect((await apply()).ok).toBe(false);
    expect(automations.writes).toHaveLength(0);
  });

  it("refuses a resource it does not implement", async () => {
    repo.stored = { websiteId: SITE, proposal: { ...DRAFT, resource: "website" } };
    expect((await apply()).ok).toBe(false);
    expect(automations.writes).toHaveLength(0);
  });

  it("does not claim a draft it is going to refuse", async () => {
    repo.stored = { websiteId: SITE, proposal: { ...DRAFT, operation: "delete" } };
    await apply();
    expect(repo.applied).toBe(false);
    expect(repo.claims).toBe(0);
  });
});

describe("ProposalApplier — changes to existing things", () => {
  it("applies an update whose target is unchanged since the draft", async () => {
    repo.stored = { websiteId: SITE, proposal: change() };
    const r = await apply();
    expect(r).toEqual({ ok: true, created: { resource: "automation", id: AUTOMATION }, operation: "update" });
    expect(automations.writes[0]).toEqual(["update", { websiteId: SITE, userId: USER, id: AUTOMATION, payload: { name: "Renamed" } }]);
  });

  it("refuses a stale draft with a clear message, and writes nothing", async () => {
    automations.rows.get(AUTOMATION)!.version = V2;
    repo.stored = { websiteId: SITE, proposal: change() };
    const r = await apply();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("stale");
      expect(r.error).toContain("out of date");
    }
    expect(automations.writes).toHaveLength(0);
    // Not burned: the claim is put back.
    expect(repo.applied).toBe(false);
  });

  it("refuses when the target no longer exists", async () => {
    automations.rows.clear();
    repo.stored = { websiteId: SITE, proposal: change() };
    const r = await apply();
    expect(r).toMatchObject({ ok: false, code: "gone" });
    expect(automations.writes).toHaveLength(0);
  });

  it("refuses a target that belongs to another website", async () => {
    automations.rows.get(AUTOMATION)!.websiteId = OTHER_SITE;
    repo.stored = { websiteId: SITE, proposal: change() };
    const r = await apply();
    expect(r).toMatchObject({ ok: false, code: "gone" });
    expect(automations.writes).toHaveLength(0);
  });

  it("refuses a change without a target", async () => {
    repo.stored = { websiteId: SITE, proposal: change({ target: undefined }) };
    expect((await apply()).ok).toBe(false);
    expect(repo.claims).toBe(0);
  });

  it("sets status through the status writer", async () => {
    repo.stored = { websiteId: SITE, proposal: change({ operation: "set_status", payload: { active: true } }) };
    expect((await apply()).ok).toBe(true);
    expect(automations.rows.get(AUTOMATION)!.active).toBe(true);
  });

  it("never deletes: archive is refused where no soft archive is wired, and nothing is removed", async () => {
    repo.stored = { websiteId: SITE, proposal: change({ operation: "archive", payload: {} }) };
    const r = await apply();
    expect(r.ok).toBe(false);
    expect(automations.rows.has(AUTOMATION)).toBe(true);
    expect(automations.writes).toHaveLength(0);
  });

  it("releases the claim when an update write fails", async () => {
    automations.failNext = true;
    repo.stored = { websiteId: SITE, proposal: change() };
    expect((await apply()).ok).toBe(false);
    expect(repo.applied).toBe(false);
    expect((await apply()).ok).toBe(true);
  });
});

describe("ProposalApplier — who may confirm", () => {
  const settings = { resource: "site_settings", operation: "update", target: { id: SITE, version: V1 }, payload: { replay_enabled: false } };

  it("refuses a viewer anything", async () => {
    const r = await apply({ role: "viewer" });
    expect(r).toMatchObject({ ok: false, code: "forbidden" });
    expect(repo.claims).toBe(0);
  });

  it("lets a member confirm an automation change but not a settings change", async () => {
    repo.stored = { websiteId: SITE, proposal: change() };
    expect((await apply({ role: "member" })).ok).toBe(true);

    repo = new FakeRepo();
    repo.stored = { websiteId: SITE, proposal: settings };
    applier = new ProposalApplier(repo as unknown as AiRepository, writers());
    const r = await apply({ role: "member" });
    expect(r).toMatchObject({ ok: false, code: "forbidden" });
    if (!r.ok) expect(r.error).toContain("admin");
    expect(settingsWrites).toHaveLength(0);
  });

  it("lets an admin and the owner confirm a settings change", async () => {
    for (const role of ["admin", "owner"] as const) {
      repo = new FakeRepo();
      repo.stored = { websiteId: SITE, proposal: settings };
      applier = new ProposalApplier(repo as unknown as AiRepository, writers());
      expect((await apply({ role })).ok).toBe(true);
    }
    expect(settingsWrites).toHaveLength(2);
  });

  it("ignores the role stored on the draft", async () => {
    repo.stored = { websiteId: SITE, proposal: { ...settings, requiredRole: "member" } };
    expect((await apply({ role: "member" })).ok).toBe(false);
  });

  it("holds a settings change to the team permission its endpoint checks", async () => {
    repo.stored = { websiteId: SITE, proposal: settings };
    const r = await apply({ role: "admin", can: (p) => p !== "analytics:settings.manage" });
    expect(r).toMatchObject({ ok: false, code: "forbidden" });
    expect(settingsWrites).toHaveLength(0);
  });

  it("holds a goal change to the goals permission", async () => {
    repo.stored = { websiteId: SITE, proposal: { resource: "goal", operation: "update", target: { id: "g", version: V1 }, payload: { name: "x" } } };
    expect((await apply({ can: () => false })).ok).toBe(false);
    expect((await apply({ can: () => true })).ok).toBe(true);
  });

  it("refuses a settings target that is not the URL's website", async () => {
    repo.stored = { websiteId: SITE, proposal: { ...settings, target: { id: OTHER_SITE, version: V1 } } };
    const r = await apply({ role: "owner" });
    expect(r).toMatchObject({ ok: false, code: "gone" });
    expect(settingsWrites).toHaveLength(0);
  });
});

describe("ProposalApplier — the applied listener", () => {
  it("is told the operation, and not told about a recommendation's own status change", async () => {
    const seen: string[] = [];
    const listen = async (e: { operation: string; created: { resource: string } }) => { seen.push(`${e.operation} ${e.created.resource}`); };
    repo.stored = { websiteId: SITE, proposal: change() };
    await new ProposalApplier(repo as unknown as AiRepository, writers(), listen).apply({ userId: USER, websiteId: SITE, queryId: QUERY, role: "member" });

    const recRepo = new FakeRepo();
    recRepo.stored = { websiteId: SITE, proposal: { resource: "recommendation", operation: "set_status", target: { id: "r", version: "open" }, payload: { status: "dismissed" } } };
    const recApplier = new ProposalApplier(recRepo as unknown as AiRepository, {
      recommendation: { version: async () => "open", setStatus: async (i) => ({ id: i.id }) },
    }, listen);
    expect((await recApplier.apply({ userId: USER, websiteId: SITE, queryId: QUERY, role: "member" })).ok).toBe(true);
    expect(seen).toEqual(["update automation"]);
  });
});
