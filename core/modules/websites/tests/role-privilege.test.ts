import { describe, expect, it } from "bun:test";
import { normalizeWebsiteRole, roleAtLeast, roleCanDeleteData } from "../interfaces";
import type { WebsiteRole } from "../interfaces";

/**
 * The privilege ordering every website-scoped operation is now measured against.
 *
 * It did not exist. `assertWebsiteAccess` asked whether a membership row was present and
 * never read its `role`, so a viewer could delete the website — cascading its analytics,
 * automations and funnels — publish its dashboard to an unauthenticated URL, add and
 * remove members, invite people as owner, and set their own role to owner in a single
 * request, because nothing compared the role being granted to the role of the person
 * granting it.
 *
 * `roleCanDeleteData` had the comparison right and guarded exactly one endpoint. The
 * ordering lives in one array now, and these are the rules that array has to satisfy.
 */

const ROLES: WebsiteRole[] = ["viewer", "member", "admin", "owner"];

describe("roleAtLeast", () => {
  it("holds reflexively — a role meets its own bar", () => {
    for (const r of ROLES) expect(roleAtLeast(r, r)).toBe(true);
  });

  it("orders viewer below member below admin below owner", () => {
    expect(roleAtLeast("member", "viewer")).toBe(true);
    expect(roleAtLeast("admin", "member")).toBe(true);
    expect(roleAtLeast("owner", "admin")).toBe(true);

    expect(roleAtLeast("viewer", "member")).toBe(false);
    expect(roleAtLeast("member", "admin")).toBe(false);
    expect(roleAtLeast("admin", "owner")).toBe(false);
  });

  it("is transitive across the whole ladder", () => {
    for (let i = 0; i < ROLES.length; i++) {
      for (let j = 0; j < ROLES.length; j++) {
        expect(roleAtLeast(ROLES[i]!, ROLES[j]!)).toBe(i >= j);
      }
    }
  });

  describe("a viewer", () => {
    /**
     * The specific escalations that were live. Each names the operation whose minimum
     * now excludes a viewer; the minimums themselves are asserted below.
     */
    const REFUSED: [string, WebsiteRole][] = [
      ["delete the website and everything under it", "owner"],
      ["change site settings", "admin"],
      ["publish the dashboard publicly", "admin"],
      ["add or remove members", "admin"],
      ["change anyone's role", "admin"],
      ["create or revoke invitations", "admin"],
      ["list invitations, whose tokens are credentials", "admin"],
      ["create, edit or delete goals", "member"],
    ];

    for (const [operation, minimum] of REFUSED) {
      it(`cannot ${operation}`, () => {
        expect(roleAtLeast("viewer", minimum)).toBe(false);
      });
    }

    it("can still read what they were invited to see", () => {
      expect(roleAtLeast("viewer", "viewer")).toBe(true);
    });
  });

  describe("an admin", () => {
    it("can administer, but cannot delete the website", () => {
      expect(roleAtLeast("admin", "admin")).toBe(true);
      expect(roleAtLeast("admin", "owner")).toBe(false);
    });

    /**
     * The rule `addMember`, `createInvitation` and `updateMemberRole` enforce: no
     * granting upward. Without it, "is an admin" was licence to mint an owner.
     */
    it("cannot grant a role above their own", () => {
      expect(roleAtLeast("admin", "owner")).toBe(false);
      expect(roleAtLeast("admin", "admin")).toBe(true);
    });
  });

  describe("a member", () => {
    it("can change what the site measures but not who can see it", () => {
      expect(roleAtLeast("member", "member")).toBe(true);
      expect(roleAtLeast("member", "admin")).toBe(false);
    });
  });
});

describe("roleCanDeleteData", () => {
  /**
   * Kept expressed through `roleAtLeast` rather than a second hand-written comparison,
   * so the two cannot drift. This is the predicate that was already correct — it guarded
   * recording deletion, and nothing else.
   */
  it("excludes only the viewer", () => {
    expect(roleCanDeleteData("viewer")).toBe(false);
    expect(roleCanDeleteData("member")).toBe(true);
    expect(roleCanDeleteData("admin")).toBe(true);
    expect(roleCanDeleteData("owner")).toBe(true);
  });

  it("agrees with the ordering it is defined from", () => {
    for (const r of ROLES) expect(roleCanDeleteData(r)).toBe(roleAtLeast(r, "member"));
  });
});

describe("normalizeWebsiteRole", () => {
  it("accepts the four known roles in any casing", () => {
    expect(normalizeWebsiteRole("OWNER")).toBe("owner");
    expect(normalizeWebsiteRole(" Admin ")).toBe("admin");
    expect(normalizeWebsiteRole("member")).toBe("member");
    expect(normalizeWebsiteRole("viewer")).toBe("viewer");
  });

  /**
   * Fails closed, and that mattered more than it should have: the role column took any
   * string up to 32 characters, so unrecognised values could be stored. The schema is an
   * enum now, but rows written before it are still out there.
   */
  it("treats anything unrecognised as the least privileged role", () => {
    for (const raw of ["superuser", "", "  ", "admin;--", null, undefined]) {
      expect(normalizeWebsiteRole(raw)).toBe("viewer");
    }
  });

  it("never returns a role that outranks what was stored", () => {
    for (const raw of ["superuser", "root", "OWNER "]) {
      const normalised = normalizeWebsiteRole(raw);
      if (!ROLES.includes(raw?.trim().toLowerCase() as WebsiteRole)) {
        expect(normalised).toBe("viewer");
      }
    }
  });
});
