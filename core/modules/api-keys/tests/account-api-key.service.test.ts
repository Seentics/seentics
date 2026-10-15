import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import bcrypt from "bcryptjs";
import { fakeDbModule, fakeLogger, queueSelectRows, resetDb } from "../../../app/tests/helpers/fake-db";

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/observability/logger", fakeLogger);

let service: typeof import("../services/account-api-key.service");

const KEY = "snt_acct_disabled-account-key-for-tests";
let row: Record<string, unknown>;

beforeAll(async () => {
  service = await import("../services/account-api-key.service");
  row = { id: "key-1", userId: "user-1", keyPrefix: KEY.slice(0, 16), keyHash: await bcrypt.hash(KEY, 4), scopes: ["read"] };
});

beforeEach(() => {
  resetDb();
  service.forgetVerifiedAccountKeys();
  queueSelectRows([row]);
});

// A disabled account could no longer sign in, but its account keys kept provisioning sites
// and reading their data through the management and raw APIs.
describe("verifyAccountApiKey", () => {
  it("accepts a key whose account is active", async () => {
    expect(await service.verifyAccountApiKey(KEY, async () => true)).toMatchObject({ userId: "user-1", apiKeyId: "key-1" });
  });

  it("refuses a key whose account is disabled", async () => {
    expect(await service.verifyAccountApiKey(KEY, async () => false)).toBeNull();
  });

  it("does not cache an answer that a revoke overtook", async () => {
    let release!: (active: boolean) => void;
    const pending = service.verifyAccountApiKey(KEY, () => new Promise<boolean>((resolve) => { release = resolve; }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    service.forgetVerifiedAccountKeys();
    release(true);
    await pending;
    // The key is gone from the database now: a fresh check must find nothing.
    queueSelectRows([]);
    expect(await service.verifyAccountApiKey(KEY, async () => true)).toBeNull();
  });
});
