import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger, queueRows, resetDb, sqlCalls } from "../../../app/tests/helpers/fake-db";

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/observability/logger", fakeLogger);

let repos: {
  whiteLabel: import("../interfaces").WhiteLabelRepository;
  alerts: import("../interfaces").AlertRepository;
  signals: import("../interfaces").SetupSignalRepository;
};

beforeAll(async () => {
  repos = {
    whiteLabel: new (await import("../repositories/white-label.repository")).PostgresWhiteLabelRepository(),
    alerts: new (await import("../repositories/alert.repository")).PostgresAlertRepository(),
    signals: new (await import("../repositories/setup-signal.repository")).PostgresSetupSignalRepository(),
  };
});

beforeEach(resetDb);

const OWNER = "99999999-9999-4999-8999-999999999999";
const ALERT = "11111111-1111-4111-8111-111111111111";
const squash = (s: string) => s.replace(/\s+/g, " ");

describe("white label repository", () => {
  it("upserts one row per owner, slug included, and maps it back", async () => {
    const row = {
      owner_id: OWNER, brand_name: "NW", logo_url: "", primary_color: "#112233", support_email: "",
      footer_text: "", hide_seentics: true, slug: "north-west", updated_at: "2026-10-17T00:00:00.000Z",
    };
    queueRows([row], [row]);
    const saved = await repos.whiteLabel.upsert({
      ownerId: OWNER, brandName: "NW", logoUrl: "", primaryColor: "#112233", supportEmail: "",
      footerText: "", hideSeentics: true, slug: "north-west", updatedAt: null,
    });
    expect(squash(sqlCalls[0]!.text)).toContain("ON CONFLICT (owner_id) DO UPDATE");
    expect(squash(sqlCalls[0]!.text)).toContain("slug = EXCLUDED.slug");
    expect(sqlCalls[0]!.values[0]).toBe(OWNER);
    expect(sqlCalls[0]!.values).toContain("north-west");
    expect(saved).toMatchObject({ ownerId: OWNER, brandName: "NW", hideSeentics: true, slug: "north-west" });
    expect((saved as { updatedAt: Date }).updatedAt).toEqual(new Date("2026-10-17T00:00:00.000Z"));
    expect(await repos.whiteLabel.find(OWNER)).toMatchObject({ primaryColor: "#112233", slug: "north-west" });
    expect(sqlCalls[1]!.values).toEqual([OWNER]);
  });
});

describe("alert repository", () => {
  it("lists only the owner's undismissed alerts, newest first", async () => {
    queueRows([{
      id: ALERT, owner_id: OWNER, client_id: null, website_id: null, kind: "tracking_stopped", resource: "",
      period: "2026-10-16", created_at: "2026-10-16T03:00:00.000Z", dismissed_at: null,
    }]);
    const [alert] = await repos.alerts.listOpen(OWNER, 50);
    const text = squash(sqlCalls[0]!.text);
    expect(text).toContain("owner_id = ?::uuid AND dismissed_at IS NULL");
    expect(text).toContain("ORDER BY created_at DESC");
    expect(sqlCalls[0]!.values).toEqual([OWNER, 50]);
    expect(alert).toMatchObject({ id: ALERT, kind: "tracking_stopped", period: "2026-10-16", dismissedAt: null });
  });

  it("dismisses by id and owner, keeping the first dismissal's time; unknown is null", async () => {
    expect(await repos.alerts.dismiss(OWNER, ALERT)).toBeNull();
    const text = squash(sqlCalls[0]!.text);
    expect(text).toContain("dismissed_at = COALESCE(dismissed_at, NOW())");
    expect(text).toContain("id = ?::uuid AND owner_id = ?::uuid");
    expect(sqlCalls[0]!.values).toEqual([ALERT, OWNER]);
  });
});

describe("setup signal repository", () => {
  it("asks client_members by owner", async () => {
    queueRows([{ ok: true }]);
    expect(await repos.signals.hasClientMember(OWNER)).toBe(true);
    expect(squash(sqlCalls[0]!.text)).toContain("FROM client_members WHERE owner_id = ?::uuid");
  });

  it("reads the gateway's custom domain only when that table exists", async () => {
    queueRows([{ ok: false }]);
    expect(await repos.signals.customDomain(OWNER)).toBeNull();
    expect(sqlCalls).toHaveLength(1);

    resetDb();
    queueRows([{ ok: true }], [{ hostname: "reports.agency.com", state: "active" }]);
    expect(await repos.signals.customDomain(OWNER)).toEqual({ hostname: "reports.agency.com", state: "active" });
    expect(squash(sqlCalls[1]!.text)).toContain("FROM agency_custom_domains WHERE owner_user_id = ?::uuid");
  });
});
