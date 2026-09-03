import { describe, expect, it } from "bun:test";
import * as jose from "jose";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../auth-jwt";

/**
 * The token layer, tested for the properties that are load-bearing rather than for
 * round-tripping.
 *
 * `env()` re-reads `process.env` on every call, so setting the secret here is enough —
 * no module mock, which matters because Bun's `mock.module` is global and a stubbed
 * `config` leaks into every other file in the run.
 *
 * What is actually being defended:
 *
 * - **Token type confusion.** The two tokens are signed with the same key and differ
 *   only by a `typ` claim, so nothing but the checks in `verify*` stops a 7-day refresh
 *   token being presented as an access token. That is a 7-day session for anyone who
 *   captures one, and it is the reason both directions are asserted below.
 * - **Algorithm confusion.** `jwtVerify` is pinned to HS256. Unpinned, a token with
 *   `alg: none` is a valid unsigned token and authenticates anyone.
 * - **Signature and expiry**, which are the ordinary reasons a token is refused.
 */

/**
 * Both are set at module scope, before any import-time or test-time `env()` call.
 *
 * `platform/lib/auth-jwt` resolves the signing key through the real `config`, and
 * `env()` validates the whole environment — so a missing `DATABASE_URL` fails token
 * signing with an error about the database. Setting them here rather than mocking
 * `config` keeps this file from installing a global module stub: Bun's `mock.module`
 * applies to the entire run, so a partial config stub breaks unrelated files.
 */
process.env.DATABASE_URL ??= "postgres://test-not-connected";
process.env.JWT_SECRET = "test-secret-value-that-is-long-enough-for-hs256";

const SECRET = process.env.JWT_SECRET;
const OTHER_SECRET = "a-completely-different-secret-value-for-testing";
const USER = "11111111-2222-3333-4444-555555555555";

const key = () => new TextEncoder().encode(SECRET);

describe("auth-jwt", () => {
  describe("round trip", () => {
    it("verifies an access token it signed", async () => {
      expect(await verifyAccessToken(await signAccessToken(USER))).toEqual({ userId: USER });
    });

    it("verifies a refresh token it signed", async () => {
      expect(await verifyRefreshToken(await signRefreshToken(USER))).toEqual({ userId: USER });
    });
  });

  describe("token type confusion", () => {
    /**
     * Same key, same algorithm — only `typ` separates a 15-minute credential from a
     * 7-day one. Both directions must be refused.
     */
    it("refuses a refresh token presented as an access token", async () => {
      const refresh = await signRefreshToken(USER);
      expect(verifyAccessToken(refresh)).rejects.toThrow();
    });

    it("refuses an access token presented as a refresh token", async () => {
      const access = await signAccessToken(USER);
      expect(verifyRefreshToken(access)).rejects.toThrow();
    });
  });

  describe("signature", () => {
    it("refuses a token signed with a different secret", async () => {
      const forged = await new jose.SignJWT({ user_id: USER })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(new TextEncoder().encode(OTHER_SECRET));

      expect(verifyAccessToken(forged)).rejects.toThrow();
    });

    it("refuses a token whose payload was edited after signing", async () => {
      const token = await signAccessToken(USER);
      const [header, , signature] = token.split(".");
      const swapped = Buffer.from(
        JSON.stringify({ user_id: "00000000-0000-0000-0000-000000000000" }),
      )
        .toString("base64url");

      expect(verifyAccessToken(`${header}.${swapped}.${signature}`)).rejects.toThrow();
    });

    it("refuses a malformed token", async () => {
      expect(verifyAccessToken("not.a.jwt")).rejects.toThrow();
      expect(verifyAccessToken("")).rejects.toThrow();
    });
  });

  describe("algorithm pinning", () => {
    /**
     * The classic JWT break: an unsigned token asserting whatever it likes. `jwtVerify`
     * is given `algorithms: ["HS256"]`, so this is refused at the algorithm check rather
     * than at the (absent) signature.
     */
    it("refuses an unsigned alg:none token", async () => {
      const unsigned = new jose.UnsecuredJWT({ user_id: USER }).encode();
      expect(verifyAccessToken(unsigned)).rejects.toThrow();
    });
  });

  describe("expiry", () => {
    it("refuses an expired token", async () => {
      const expired = await new jose.SignJWT({ user_id: USER })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(key());

      expect(verifyAccessToken(expired)).rejects.toThrow();
    });

    it("gives an access token a shorter life than a refresh token", async () => {
      const access = jose.decodeJwt(await signAccessToken(USER));
      const refresh = jose.decodeJwt(await signRefreshToken(USER));
      expect(access.exp!).toBeLessThan(refresh.exp!);
    });
  });

  describe("subject claim", () => {
    it("refuses a token carrying no user_id", async () => {
      const empty = await new jose.SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(key());

      expect(verifyAccessToken(empty)).rejects.toThrow();
    });

    it("refuses a token whose user_id is an empty string", async () => {
      const blank = await new jose.SignJWT({ user_id: "" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(key());

      expect(verifyAccessToken(blank)).rejects.toThrow();
    });

    it("refuses a non-string user_id on the refresh path", async () => {
      // `verifyAccessToken` coerces a numeric id; the refresh path deliberately does not.
      const numeric = await new jose.SignJWT({ user_id: 42, typ: "refresh" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(key());

      expect(verifyRefreshToken(numeric)).rejects.toThrow();
    });
  });
});
