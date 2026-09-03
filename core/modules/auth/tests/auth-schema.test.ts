import { describe, expect, it } from "bun:test";
import {
  authLoginSchema,
  authRefreshSchema,
  authRegisterSchema,
} from "../validators/auth.schema";

/**
 * The credential input boundary.
 *
 * These schemas run before anything reaches bcrypt or the database, which makes them
 * the place where two properties are decided: the minimum password a user is allowed to
 * choose, and the maximum input the process will hash.
 *
 * The upper bounds are not cosmetic. bcrypt cost is fixed at 12 in `auth.service`, so a
 * caller who can post an unbounded password string can spend the server's CPU at will —
 * the 256-character cap is what makes the work per request bounded. Registration is
 * unauthenticated, so nothing else limits how often that costs anything.
 */

const VALID_REGISTER = {
  email: "person@example.com",
  password: "correct horse battery",
  name: "A Person",
};

describe("authRegisterSchema", () => {
  it("accepts a well-formed registration", () => {
    expect(authRegisterSchema.safeParse(VALID_REGISTER).success).toBe(true);
  });

  describe("password bounds", () => {
    it("requires at least 8 characters", () => {
      expect(authRegisterSchema.safeParse({ ...VALID_REGISTER, password: "short12" }).success)
        .toBe(false);
      expect(authRegisterSchema.safeParse({ ...VALID_REGISTER, password: "exactly8" }).success)
        .toBe(true);
    });

    it("caps length, so an unauthenticated caller cannot choose how much bcrypt work to buy", () => {
      expect(
        authRegisterSchema.safeParse({ ...VALID_REGISTER, password: "a".repeat(256) }).success,
      ).toBe(true);
      expect(
        authRegisterSchema.safeParse({ ...VALID_REGISTER, password: "a".repeat(257) }).success,
      ).toBe(false);
    });

    it("rejects a missing or empty password", () => {
      expect(authRegisterSchema.safeParse({ ...VALID_REGISTER, password: "" }).success).toBe(false);
      expect(authRegisterSchema.safeParse({ email: VALID_REGISTER.email }).success).toBe(false);
    });
  });

  describe("email", () => {
    it("rejects a value that is not an email", () => {
      for (const email of ["not-an-email", "", "@example.com", "a@"]) {
        expect(authRegisterSchema.safeParse({ ...VALID_REGISTER, email }).success).toBe(false);
      }
    });
  });

  describe("name", () => {
    it("defaults to empty when absent", () => {
      const parsed = authRegisterSchema.parse({
        email: VALID_REGISTER.email,
        password: VALID_REGISTER.password,
      });
      // `registerUser` turns this into the email's local part.
      expect(parsed.name).toBe("");
    });

    it("trims surrounding whitespace", () => {
      expect(authRegisterSchema.parse({ ...VALID_REGISTER, name: "  A Person  " }).name)
        .toBe("A Person");
    });

    it("caps length", () => {
      expect(authRegisterSchema.safeParse({ ...VALID_REGISTER, name: "n".repeat(121) }).success)
        .toBe(false);
    });
  });
});

describe("authLoginSchema", () => {
  it("accepts a well-formed login", () => {
    expect(
      authLoginSchema.safeParse({ email: "person@example.com", password: "anything" }).success,
    ).toBe(true);
  });

  it("does not impose the registration minimum", () => {
    // A short password predates the 8-character rule; refusing it at the schema would
    // lock out an existing account rather than failing the credential check.
    expect(authLoginSchema.safeParse({ email: "person@example.com", password: "old" }).success)
      .toBe(true);
  });

  it("still caps length", () => {
    expect(
      authLoginSchema.safeParse({ email: "person@example.com", password: "a".repeat(257) })
        .success,
    ).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(authLoginSchema.safeParse({ email: "person@example.com", password: "" }).success)
      .toBe(false);
  });
});

describe("authRefreshSchema", () => {
  it("accepts a token", () => {
    expect(authRefreshSchema.safeParse({ refresh_token: "a.b.c" }).success).toBe(true);
  });

  it("rejects an empty token", () => {
    expect(authRefreshSchema.safeParse({ refresh_token: "" }).success).toBe(false);
  });

  it("caps length, so verification cannot be handed an unbounded string", () => {
    expect(authRefreshSchema.safeParse({ refresh_token: "a".repeat(4097) }).success).toBe(false);
  });
});
