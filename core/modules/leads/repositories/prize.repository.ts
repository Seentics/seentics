import { sql } from "../../../db";
import type { Prize } from "../interfaces";

/**
 * The prize this email already won from this popup, or record the one `draw` picks.
 *
 * Concurrent submissions from one address cannot both win: the insert is a no-op for the
 * loser, which then reads the winner's row, so both visitors are told the same prize.
 * `draw` runs only when nothing is recorded yet, and may return `null` (nothing can win),
 * in which case nothing is recorded.
 */
export async function claimPrize(
  websiteId: string,
  automationId: string,
  emailHash: string,
  draw: () => Prize | null,
): Promise<Prize | null> {
  const existing = await findPrize(websiteId, automationId, emailHash);
  if (existing) return existing;

  const drawn = draw();
  if (!drawn) return null;
  const inserted = await sql`
    INSERT INTO form_prizes (website_id, automation_id, email_hash, prize)
    VALUES (${websiteId}::uuid, ${automationId}::uuid, ${emailHash}, ${JSON.stringify(drawn)}::jsonb)
    ON CONFLICT (website_id, automation_id, email_hash) DO NOTHING
    RETURNING email_hash
  `;
  if (inserted.length > 0) return drawn;
  return (await findPrize(websiteId, automationId, emailHash)) ?? drawn;
}

async function findPrize(websiteId: string, automationId: string, emailHash: string): Promise<Prize | null> {
  const [row] = await sql<{ prize: Prize }[]>`
    SELECT prize FROM form_prizes
    WHERE website_id = ${websiteId}::uuid AND automation_id = ${automationId}::uuid AND email_hash = ${emailHash}
  `;
  return row?.prize ?? null;
}
