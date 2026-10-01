import { createHash, randomBytes } from "node:crypto";
import { sql } from "../../db";

/**
 * Anonymous visitors: counted without anything stored in their browser.
 *
 * A visitor who has not consented carries no id. Each of their events is given one
 * here: a hash of the day's salt, the website, their IP address and user agent. The
 * same person on the same site on the same day gets the same id, so visitors and visits
 * still count; across days, sites or devices they cannot be linked; and the salt is
 * random, held for a day and then deleted, so a hash cannot be traced back to anyone —
 * by us either — once it is gone. The IP address itself is never stored.
 */

let cached: { day: string; salt: Buffer } | null = null;

/** Today's salt (UTC), shared by every instance through `visitor_salts`. */
export async function dailyVisitorSalt(now = new Date()): Promise<Buffer> {
  const day = now.toISOString().slice(0, 10);
  if (cached?.day === day) return cached.salt;

  await sql`INSERT INTO visitor_salts (day, salt) VALUES (${day}::date, ${randomBytes(32)}) ON CONFLICT (day) DO NOTHING`;
  const [row] = await sql<{ salt: Buffer }[]>`SELECT salt FROM visitor_salts WHERE day = ${day}::date`;
  // Only today's salt is ever used, so every earlier one is deleted as soon as a new day
  // begins: keeping it would only keep the means to re-identify yesterday's visitors.
  await sql`DELETE FROM visitor_salts WHERE day < ${day}::date`;

  cached = { day, salt: Buffer.from(row!.salt) };
  return cached.salt;
}

/** The anonymous id for one visitor on one website, for the salt's day. */
export function anonymousVisitorId(salt: Buffer, websiteId: string, ip: string, userAgent: string): string {
  const hash = createHash("sha256")
    .update(salt)
    .update("\0").update(websiteId)
    .update("\0").update(ip)
    .update("\0").update(userAgent)
    .digest("hex");
  return `h-${hash.slice(0, 32)}`;
}
