import { randomUUID } from "node:crypto";
import { sql } from "../harness";

/** A page step / event step in the stored JSONB shape the builder sends. */
export const pageStep = (name: string, page_path: string, match_type = "exact", order?: number) => ({
  id: randomUUID(), name, step_type: "page_view", page_path, match_type, ...(order !== undefined ? { order } : {}),
});
export const eventStep = (name: string, event_type: string) => ({ id: randomUUID(), name, step_type: "event", event_type, match_type: "exact" });

/** One visitor's journey: each entry is a page path or `{ event }`, `minutesAgo` apart from now. */
export async function seedJourney(
  websiteId: string,
  steps: Array<{ page?: string; event?: string; minutesAgo: number }>,
  visitorId = `v-${randomUUID().slice(0, 8)}`,
) {
  const sessionId = `s-${randomUUID().slice(0, 8)}`;
  for (const s of steps) {
    const type = s.event ?? "pageview";
    await sql`INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, occurred_at)
              VALUES (${websiteId}, ${type}, ${s.page ?? null}, ${visitorId}, ${sessionId},
                      now() - make_interval(mins => ${s.minutesAgo}))`;
  }
  return visitorId;
}
