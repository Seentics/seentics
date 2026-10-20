import { describe, expect, it } from "bun:test";
import { UserDirectoryService } from "../services/user-directory.service";
import { FakeUserRepository } from "./fake-user-repository";

describe("UserDirectoryService.updateName", () => {
  // PUT /user/users/profile used to read the body and discard it.
  it("renames the user and returns the client shape", async () => {
    const repo = new FakeUserRepository();
    const row = repo.seed({ email: "a@example.com", passwordHash: "x", name: "Before" });
    const user = await new UserDirectoryService(repo).updateName(row.id, "After");
    expect(user?.name).toBe("After");
    expect(repo.rows[0]?.name).toBe("After");
  });

  it("answers null for an unknown user", async () => {
    expect(await new UserDirectoryService(new FakeUserRepository()).updateName("nobody", "X")).toBeNull();
  });
});
