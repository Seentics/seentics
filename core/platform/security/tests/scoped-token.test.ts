import { describe, expect, it } from "bun:test";
import { signScopedToken, verifyScopedToken } from "../scoped-token";

describe("scoped tokens", () => {
  const exp = 2_000_000_000;
  const token = signScopedToken("secret", "replay-stylesheet", "site-a", exp);

  it("verifies for the same secret, scope and subject until it expires", () => {
    expect(verifyScopedToken("secret", "replay-stylesheet", "site-a", token, exp - 1)).toBe(true);
    expect(verifyScopedToken("secret", "replay-stylesheet", "site-a", token, exp + 1)).toBe(false);
  });

  it("is bound to its subject, scope and secret", () => {
    expect(verifyScopedToken("secret", "replay-stylesheet", "site-b", token, exp - 1)).toBe(false);
    expect(verifyScopedToken("secret", "other-scope", "site-a", token, exp - 1)).toBe(false);
    expect(verifyScopedToken("other", "replay-stylesheet", "site-a", token, exp - 1)).toBe(false);
  });

  it("refuses a moved expiry and malformed input", () => {
    const [, sig] = token.split(".");
    expect(verifyScopedToken("secret", "replay-stylesheet", "site-a", `${exp + 86_400}.${sig}`, exp - 1)).toBe(false);
    for (const bad of ["", ".", "abc.def", `${exp}`, `${exp}.`, `-1.${sig}`, undefined, null]) {
      expect(verifyScopedToken("secret", "replay-stylesheet", "site-a", bad as string, exp - 1)).toBe(false);
    }
  });
});
