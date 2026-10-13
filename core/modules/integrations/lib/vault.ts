import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encryption for integration credentials, AES-256-GCM with a versioned envelope.
 *
 * Ciphertext is `v1.<keyId>.<iv>.<tag>.<data>` (base64url parts). The version leaves room to
 * change the scheme; the key id — the first eight hex characters of the key's SHA-256, which
 * reveals nothing usable — says which key sealed it. That is what makes rotation work: put the
 * new key in `INTEGRATIONS_ENCRYPTION_KEY`, keep the old one in `…_PREVIOUS`, and everything
 * stored under the old key still opens while new writes use the new one.
 *
 * GCM authenticates as well as encrypts, so a flipped bit, a truncated value or a value
 * from another key is an error, never garbage plaintext. The website and provider are
 * bound in as additional authenticated data, so a ciphertext copied from one connection's row
 * to another's does not open.
 */

const VERSION = "v1";

export class VaultError extends Error {}

export type VaultKeys = { current: string; previous: readonly string[] };

/** A 32-byte key from the 64-hex or 44-char base64 form the config accepts. */
function keyBytes(encoded: string): Buffer {
  const raw = /^[0-9a-f]{64}$/i.test(encoded) ? Buffer.from(encoded, "hex") : Buffer.from(encoded, "base64");
  if (raw.length !== 32) throw new VaultError("encryption key must be 32 bytes");
  return raw;
}

const keyId = (key: Buffer) => createHash("sha256").update(key).digest("hex").slice(0, 8);

export class Vault {
  private readonly current: { id: string; key: Buffer };
  private readonly byId = new Map<string, Buffer>();

  constructor(keys: VaultKeys) {
    const current = keyBytes(keys.current);
    this.current = { id: keyId(current), key: current };
    this.byId.set(this.current.id, current);
    for (const previous of keys.previous) {
      const key = keyBytes(previous);
      this.byId.set(keyId(key), key);
    }
  }

  encrypt(plaintext: string, aad: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.current.key, iv);
    cipher.setAAD(Buffer.from(aad));
    const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return [VERSION, this.current.id, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
  }

  decrypt(ciphertext: string, aad: string): string {
    const parts = ciphertext.split(".");
    if (parts.length !== 5 || parts[0] !== VERSION) throw new VaultError("unrecognised ciphertext format");
    const [, id, iv, tag, data] = parts as [string, string, string, string, string];
    const key = this.byId.get(id);
    if (!key) throw new VaultError("no key available for this ciphertext");
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
      decipher.setAAD(Buffer.from(aad));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
    } catch {
      // The underlying message names nothing useful and must not hint at the key.
      throw new VaultError("credentials could not be decrypted");
    }
  }

  /** Whether `ciphertext` is sealed under the current key, so a sweep can find rows to re-seal. */
  usesCurrentKey(ciphertext: string): boolean {
    return ciphertext.split(".")[1] === this.current.id;
  }
}

/** A fixed key for development only, so a fresh checkout works. Never used in production. */
const DEV_KEY = createHash("sha256").update("seentics-dev-only-integrations-key").digest("hex");

export type VaultResolution =
  | { vault: Vault; ephemeralDevKey: boolean }
  | { vault: null; reason: string };

/**
 * Build the vault from config, or say why there is none.
 *
 * Production without a key yields no vault: connecting is refused with a clear message and
 * existing connections fail their deliveries loudly, rather than falling back to a key that
 * is in the source. Development without a key uses the fixed dev key and says so — `ephemeralDevKey`
 * is the flag the module logs a warning for.
 */
export function resolveVault(cfg: { isProduction: boolean; integrations: { encryptionKey: string; previousKeys: readonly string[] } }): VaultResolution {
  const { encryptionKey, previousKeys } = cfg.integrations;
  if (encryptionKey) return { vault: new Vault({ current: encryptionKey, previous: previousKeys }), ephemeralDevKey: false };
  if (cfg.isProduction) {
    return { vault: null, reason: "INTEGRATIONS_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and restart." };
  }
  return { vault: new Vault({ current: DEV_KEY, previous: previousKeys }), ephemeralDevKey: true };
}
