import type { InferSelectModel } from "drizzle-orm";
import type { users } from "../../../db/schema";

/** A `users` row exactly as stored — password hash included. Never leaves this module. */
export type UserRow = InferSelectModel<typeof users>;

/** What a registration needs, with hashing already done by the service. */
export type NewUser = {
  email: string;
  passwordHash: string;
  name: string;
  /**
   * Role for the very first account in an empty install, and for everyone after.
   *
   * Both are passed in rather than decided by the repository because "the first user
   * administers the install" is a policy, not a storage concern — but *which* user is
   * first can only be answered inside the same transaction as the insert, which is
   * where the repository lives. So the service names the roles and the repository
   * picks between them atomically. See `create`.
   */
  firstUserRole: string;
  role: string;
};

/** The narrow projection peers are allowed to see. */
export type UserProfileRow = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
};

/**
 * Storage for `users`.
 *
 * Extracted so that `AuthService` holds no `db` handle. That is not tidiness: before
 * this port existed, registration and login could not be exercised without a live
 * Postgres, and so they were the only unauthenticated write paths in the product with
 * no tests at all — the first-user-becomes-admin rule and the disabled-account check
 * were both unverified. The fake in `tests/fake-user-repository.ts` is what they are
 * tested against now.
 */
export interface UserRepository {
  /** Total accounts. Drives the setup-status endpoint. */
  countAll(): Promise<number>;

  /**
   * Insert a new account, or `null` when the email is already taken.
   *
   * Atomic by contract: the existence check, the count that decides the role, and the
   * insert are one transaction. Two simultaneous registrations into an empty install
   * must not both read a count of zero and both become admin.
   *
   * `email` is stored as given — the service lower-cases it first.
   */
  create(input: NewUser): Promise<UserRow | null>;

  /** Whole row, for the credential check. `null` when no such email. */
  findByEmail(email: string): Promise<UserRow | null>;

  /** Whole row by id. `null` when no such user. */
  findById(id: string): Promise<UserRow | null>;

  /**
   * Record a successful sign-in and return the updated row.
   *
   * One call rather than update-then-select: the caller needs the fresh `loginCount`
   * for the response, and reading it back separately is a second round trip that can
   * also observe another session's increment.
   */
  recordLogin(id: string): Promise<UserRow | null>;

  /** Narrow projection by id, for `UserDirectory`. */
  profileById(id: string): Promise<UserProfileRow | null>;

  /** Narrow projection by email. The caller normalises the address. */
  profileByEmail(email: string): Promise<UserProfileRow | null>;

  /** Narrow projections for many ids at once, keyed by id. Batched to avoid an N+1. */
  profilesByIds(ids: readonly string[]): Promise<Map<string, UserProfileRow>>;
}
