/**
 * Password hashing, as a port.
 *
 * Injected for one practical reason: bcrypt at cost 12 takes roughly a quarter of a
 * second by design, and a test that registers and logs in would pay that twice. The
 * whole suite runs in about two seconds, so a handful of real-bcrypt tests would cost
 * more than everything else combined — and the result would be a slow suite that people
 * stop running, which is worse than the coverage is good.
 *
 * The cost stays fixed in the real implementation. Nothing here lets a caller choose a
 * cheaper hash at runtime; the seam exists for the test double and nothing else.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;

  /**
   * Constant-time comparison of a candidate against a stored hash.
   *
   * Returns `false` rather than throwing on a malformed stored hash — a corrupted row
   * is a failed credential check, not a 500.
   */
  verify(plain: string, hash: string): Promise<boolean>;
}
