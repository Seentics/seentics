import { describe, it, expect, beforeEach } from "bun:test";
import { ProposalApplier } from "../services/agent/proposal-applier";
import type { AiRepository } from "../interfaces/ai-repository.interface";

const USER = "user-1";
const SITE = "11111111-1111-4111-8111-111111111111";
const OTHER_SITE = "22222222-2222-4222-8222-222222222222";
const QUERY = "query-1";

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
}

let repo: FakeRepo;
let created: unknown[];
let applier: ProposalApplier;

beforeEach(() => {
  repo = new FakeRepo();
  created = [];
  applier = new ProposalApplier(repo as unknown as AiRepository, {
    async createAutomation(input) {
      created.push(input);
      return { id: "automation-1" };
    },
  });
});

const apply = (over: Partial<{ userId: string; websiteId: string; queryId: string }> = {}) =>
  applier.apply({ userId: USER, websiteId: SITE, queryId: QUERY, ...over });

describe("ProposalApplier", () => {
  it("creates the resource the stored draft describes", async () => {
    const r = await apply();
    expect(r).toEqual({ ok: true, created: { resource: "automation", id: "automation-1" } });
    expect(created).toHaveLength(1);
  });

  it("passes the stored payload, not one from the request", async () => {
    // The whole point of the confirmation screen: what was shown is what gets created.
    await apply();
    expect((created[0] as any).payload).toEqual({ name: "Exit offer", status: "draft" });
  });

  it("refuses a draft belonging to another website", async () => {
    // A draft approved for one site must not be creatable against another.
    const r = await apply({ websiteId: OTHER_SITE });
    expect(r.ok).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("refuses when there is no pending draft", async () => {
    repo.stored = null;
    const r = await apply();
    expect(r.ok).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("creates once when confirmed twice", async () => {
    // Double-click, retry, two tabs. The second confirm must not produce a second
    // automation on the customer's live site.
    const first = await apply();
    const second = await apply();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(created).toHaveLength(1);
  });

  it("claims the draft before writing, not after", async () => {
    // Claim-then-write means a lost race creates nothing. Write-then-claim would create
    // twice and record once.
    let claimedBeforeWrite = false;
    const ordered = new ProposalApplier(repo as unknown as AiRepository, {
      async createAutomation(input) {
        claimedBeforeWrite = repo.applied;
        created.push(input);
        return { id: "automation-1" };
      },
    });
    await ordered.apply({ userId: USER, websiteId: SITE, queryId: QUERY });
    expect(claimedBeforeWrite).toBe(true);
  });

  it("refuses an operation it does not implement", async () => {
    repo.stored = { websiteId: SITE, proposal: { ...DRAFT, operation: "delete" } };
    expect((await apply()).ok).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("refuses a resource it does not implement", async () => {
    // The switch is the entire list of things an approved proposal can create. Anything
    // else is refused rather than guessed at.
    repo.stored = { websiteId: SITE, proposal: { ...DRAFT, resource: "website" } };
    expect((await apply()).ok).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("does not claim a draft it is going to refuse", async () => {
    repo.stored = { websiteId: SITE, proposal: { ...DRAFT, operation: "delete" } };
    await apply();
    // Refusing an unsupported operation must leave the draft confirmable once it is
    // understood, rather than burning it.
    expect(repo.applied).toBe(false);
  });
});
