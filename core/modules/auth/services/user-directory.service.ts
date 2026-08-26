import { eq, inArray } from "drizzle-orm";
import { db, users } from "../../../db";
import type { FrontendUser, UserDirectory, UserProfile } from "../interfaces";
import { toFrontendUser } from "./user-mapper";

/** Only the fields `UserProfile` exposes — never the password hash. */
const PROFILE_COLUMNS = {
  id: users.id,
  email: users.email,
  name: users.name,
  createdAt: users.createdAt,
} as const;

/**
 * `UserDirectory` over the `users` table.
 *
 * Deliberately a narrow projection: `getUserById` in `auth.service.ts` returns the
 * whole row, password hash included, and two callers outside this module were using it.
 */
export class UserDirectoryService implements UserDirectory {
  async getById(userId: string): Promise<UserProfile | null> {
    const [row] = await db.select(PROFILE_COLUMNS).from(users).where(eq(users.id, userId)).limit(1);
    return row ?? null;
  }

  async getProfileForClient(userId: string): Promise<FrontendUser | null> {
    const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return row ? toFrontendUser(row) : null;
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const [row] = await db
      .select(PROFILE_COLUMNS)
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    return row ?? null;
  }

  async listByIds(userIds: readonly string[]): Promise<Map<string, UserProfile>> {
    if (userIds.length === 0) return new Map();
    const rows = await db
      .select(PROFILE_COLUMNS)
      .from(users)
      .where(inArray(users.id, [...userIds]));
    return new Map(rows.map((r) => [r.id, r]));
  }
}
