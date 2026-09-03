import { count, eq, inArray, sql } from "drizzle-orm";
import { db, users } from "../../../db";
import type {
  NewUser,
  UserProfileRow,
  UserRepository,
  UserRow,
} from "../interfaces/user-repository.interface";

/**
 * `UserRepository` over Postgres.
 *
 * The only file in this module that touches `db` — everything else in `services/` now
 * holds the port. Keeping that true is what makes the auth logic testable.
 */

/** Only the fields `UserProfileRow` exposes — never the password hash. */
const PROFILE_COLUMNS = {
  id: users.id,
  email: users.email,
  name: users.name,
  createdAt: users.createdAt,
} as const;

export class PostgresUserRepository implements UserRepository {
  async countAll(): Promise<number> {
    const [r] = await db.select({ c: count() }).from(users);
    return Number(r?.c ?? 0);
  }

  /**
   * One transaction: check, count, insert.
   *
   * The count decides the role, so it has to be read inside the same transaction as the
   * insert — otherwise two registrations into an empty install can both see zero and
   * both become admin.
   */
  async create(input: NewUser): Promise<UserRow | null> {
    return db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      if (existing.length) return null;

      const [{ c }] = await tx.select({ c: count() }).from(users);
      const isFirst = Number(c ?? 0) === 0;

      const [inserted] = await tx
        .insert(users)
        .values({
          email: input.email,
          passwordHash: input.passwordHash,
          name: input.name,
          role: isFirst ? input.firstUserRole : input.role,
        })
        .returning();

      return inserted ?? null;
    });
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async recordLogin(id: string): Promise<UserRow | null> {
    const now = new Date();
    // `login_count + 1` in SQL rather than a read-modify-write, so two concurrent
    // sign-ins cannot both write the same value.
    const [row] = await db
      .update(users)
      .set({
        loginCount: sql`${users.loginCount} + 1`,
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, id))
      .returning();
    return row ?? null;
  }

  async profileById(id: string): Promise<UserProfileRow | null> {
    const [row] = await db.select(PROFILE_COLUMNS).from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async profileByEmail(email: string): Promise<UserProfileRow | null> {
    const [row] = await db
      .select(PROFILE_COLUMNS)
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row ?? null;
  }

  async profilesByIds(ids: readonly string[]): Promise<Map<string, UserProfileRow>> {
    if (ids.length === 0) return new Map();
    const rows = await db
      .select(PROFILE_COLUMNS)
      .from(users)
      .where(inArray(users.id, [...ids]));
    return new Map(rows.map((r) => [r.id, r]));
  }
}
