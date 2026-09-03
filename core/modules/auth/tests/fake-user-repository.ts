import type {
  NewUser,
  PasswordHasher,
  UserProfileRow,
  UserRepository,
  UserRow,
} from "../interfaces";

/**
 * An in-memory `UserRepository`, holding whole rows the way Postgres does.
 *
 * `create` reproduces the one behaviour that matters for the tests around it: the
 * existence check and the count that decides the role happen together, so the
 * first-user-is-admin rule can be exercised without a database.
 */
export class FakeUserRepository implements UserRepository {
  readonly rows: UserRow[] = [];
  /** Set to make the next `create` behave as though the insert lost a race. */
  createReturnsNull = false;

  private nextId = 1;

  seed(overrides: Partial<UserRow> & { email: string; passwordHash: string }): UserRow {
    const row: UserRow = {
      id: `user-${this.nextId++}`,
      email: overrides.email,
      passwordHash: overrides.passwordHash,
      name: overrides.name ?? "Seeded",
      role: overrides.role ?? "user",
      avatarUrl: overrides.avatarUrl ?? null,
      isEmailVerified: overrides.isEmailVerified ?? false,
      isActive: overrides.isActive ?? true,
      loginCount: overrides.loginCount ?? 0,
      lastLoginAt: overrides.lastLoginAt ?? null,
      googleId: overrides.googleId ?? null,
      githubId: overrides.githubId ?? null,
      createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: overrides.updatedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    };
    this.rows.push(row);
    return row;
  }

  async countAll(): Promise<number> {
    return this.rows.length;
  }

  async create(input: NewUser): Promise<UserRow | null> {
    if (this.createReturnsNull) return null;
    if (this.rows.some((r) => r.email === input.email)) return null;

    return this.seed({
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name,
      // The real repository reads the count inside the insert transaction.
      role: this.rows.length === 0 ? input.firstUserRole : input.role,
    });
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    return this.rows.find((r) => r.email === email) ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async recordLogin(id: string): Promise<UserRow | null> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return null;
    row.loginCount += 1;
    row.lastLoginAt = new Date("2026-06-01T12:00:00.000Z");
    return row;
  }

  async profileById(id: string): Promise<UserProfileRow | null> {
    return profile(this.rows.find((r) => r.id === id));
  }

  async profileByEmail(email: string): Promise<UserProfileRow | null> {
    return profile(this.rows.find((r) => r.email === email));
  }

  async profilesByIds(ids: readonly string[]): Promise<Map<string, UserProfileRow>> {
    const out = new Map<string, UserProfileRow>();
    for (const r of this.rows) {
      if (ids.includes(r.id)) out.set(r.id, profile(r)!);
    }
    return out;
  }
}

function profile(row: UserRow | undefined): UserProfileRow | null {
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, createdAt: row.createdAt };
}

/**
 * A hasher with no cryptography.
 *
 * Real bcrypt at cost 12 costs roughly 250ms per call by design, which is more than the
 * entire rest of the suite. The prefix keeps a "hash" distinguishable from the
 * plaintext so a test asserting the stored value cannot pass by accident.
 */
export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}
