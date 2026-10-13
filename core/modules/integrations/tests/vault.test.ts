import { describe, expect, it } from "bun:test";
import { Vault, VaultError, resolveVault } from "../lib/vault";
import { lastChars, redact } from "../lib/mask";

const KEY_A = Buffer.alloc(32, 1).toString("base64");
const KEY_B = "ab".repeat(32);
const AAD = "site-1:mailchimp";

describe("Vault", () => {
  it("round-trips and never stores plaintext", () => {
    const vault = new Vault({ current: KEY_A, previous: [] });
    const sealed = vault.encrypt('{"api_key":"secret-value-123"}', AAD);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("secret-value");
    expect(vault.decrypt(sealed, AAD)).toBe('{"api_key":"secret-value-123"}');
  });

  it("uses a fresh nonce each time", () => {
    const vault = new Vault({ current: KEY_A, previous: [] });
    expect(vault.encrypt("same", AAD)).not.toBe(vault.encrypt("same", AAD));
  });

  it("detects tampering in any part", () => {
    const vault = new Vault({ current: KEY_A, previous: [] });
    const parts = vault.encrypt("payload", AAD).split(".");
    for (const i of [2, 3, 4]) {
      const bad = [...parts];
      const chars = bad[i]!.split("");
      chars[0] = chars[0] === "A" ? "B" : "A";
      bad[i] = chars.join("");
      expect(() => vault.decrypt(bad.join("."), AAD), `part ${i}`).toThrow(VaultError);
    }
    expect(() => vault.decrypt(parts.slice(0, 4).join("."), AAD)).toThrow(VaultError);
    expect(() => vault.decrypt("v9.x.y.z.w", AAD)).toThrow(VaultError);
  });

  it("refuses a ciphertext moved to another connection", () => {
    const vault = new Vault({ current: KEY_A, previous: [] });
    const sealed = vault.encrypt("payload", AAD);
    expect(() => vault.decrypt(sealed, "site-2:mailchimp")).toThrow(VaultError);
  });

  it("refuses the wrong key without revealing why", () => {
    const sealed = new Vault({ current: KEY_A, previous: [] }).encrypt("payload", AAD);
    const other = new Vault({ current: KEY_B, previous: [] });
    expect(() => other.decrypt(sealed, AAD)).toThrow("no key available");
  });

  it("opens old ciphertext after rotation, and new writes use the new key", () => {
    const old = new Vault({ current: KEY_A, previous: [] }).encrypt("payload", AAD);
    const rotated = new Vault({ current: KEY_B, previous: [KEY_A] });
    expect(rotated.decrypt(old, AAD)).toBe("payload");
    expect(rotated.usesCurrentKey(old)).toBe(false);
    expect(rotated.usesCurrentKey(rotated.encrypt("x", AAD))).toBe(true);
  });

  it("rejects keys that are not 32 bytes", () => {
    expect(() => new Vault({ current: "AAAA", previous: [] })).toThrow(VaultError);
  });
});

describe("resolveVault", () => {
  it("uses the configured key", () => {
    const r = resolveVault({ isProduction: true, integrations: { encryptionKey: KEY_A, previousKeys: [] } });
    expect(r.vault).not.toBeNull();
    expect("ephemeralDevKey" in r && r.ephemeralDevKey).toBe(false);
  });

  it("refuses to fall back to a built-in key in production", () => {
    const r = resolveVault({ isProduction: true, integrations: { encryptionKey: "", previousKeys: [] } });
    expect(r.vault).toBeNull();
    expect("reason" in r && r.reason).toContain("INTEGRATIONS_ENCRYPTION_KEY");
  });

  it("flags the development fallback so it can be logged", () => {
    const r = resolveVault({ isProduction: false, integrations: { encryptionKey: "", previousKeys: [] } });
    expect(r.vault).not.toBeNull();
    expect("ephemeralDevKey" in r && r.ephemeralDevKey).toBe(true);
  });
});

describe("mask", () => {
  it("shows only the tail of a long secret", () => {
    expect(lastChars("abcdefghijklmnop")).toBe("mnop");
    expect(lastChars("short")).toBe("");
  });
  it("redacts every occurrence of a secret", () => {
    expect(redact("bad key sk_live_123456 and again sk_live_123456", ["sk_live_123456"])).toBe("bad key [redacted] and again [redacted]");
  });
});
