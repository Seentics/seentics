/**
 * Writing the visitor profile.
 *
 * `loadUserProfile` in `evaluate.service.ts` has always read this table to build the
 * condition context, but nothing ever wrote a row — the only writer was an
 * `upsertUserProfile` method whose own comment recorded that no endpoint called it.
 * So `country`, `device`, `visitCount` and every custom property resolved to
 * `undefined`, the evaluator failed closed as designed, and any condition naming them
 * was permanently false. Silently: a fact that cannot be resolved looks exactly like a
 * fact that is false.
 *
 * Nothing new is collected to fix that. Every value here already arrives on the
 * `/tracker/collect` request — the MaxMind lookup and the Bowser user-agent parse are
 * done once per batch as `ingestMeta`, and the visitor id rides on each event. This
 * service just persists what was already in hand.
 */

import { sql as rawSql } from 'drizzle-orm';
import { db, userProfiles } from '../../../db';
import { log } from '../../../platform/lib/logger';

/** Session window used to decide whether a batch begins a new visit. */
const VISIT_GAP_MINUTES = 30;

export type VisitorProfileWrite = {
  websiteId: string;
  /** The tracker's visitor id (`snc_vid`), which is what conditions are keyed on. */
  anonymousId: string;
  /** Set by `seentics.identify()`; left alone when absent so a later batch cannot clear it. */
  userId?: string | null;
  /** Traits from `seentics.identify()`. Merged into `properties`, not replacing it. */
  traits?: Record<string, unknown>;
  /** Pageviews in this batch, added to the running total. */
  pageViews: number;
  /** From `ingestMeta` — already resolved for the analytics rows. */
  country?: string | null;
  region?: string | null;
  city?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  language?: string | null;
};

/** Drop keys with no value so a null never overwrites a good stored value. */
function present(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== null && v !== undefined && v !== '') out[k] = v;
  }
  return out;
}

/**
 * Upsert one visitor's profile.
 *
 * Fire-and-forget from the collect path: a failed profile write must not fail an
 * ingest batch, because the analytics rows are the thing the request is actually for.
 *
 * Four details matter for the numbers to mean what their names say:
 *
 *  - `visitCount` advances only when the last event was longer ago than the session
 *    window. Incrementing per upsert would make it count batches — and the tracker
 *    sends several per visit — so a first-time visitor would look like a regular
 *    within a minute.
 *  - `properties` is merged with `||`, not assigned. `identify()` may be called with
 *    a partial set of traits on any page, and assignment would drop everything not
 *    named in the most recent call.
 *  - Geography and device fall back to what is stored via `COALESCE`. A batch that
 *    arrives without a resolvable IP should not blank a country already known.
 *  - `firstSeenAt` is only written on insert.
 */
export async function upsertVisitorProfile(w: VisitorProfileWrite): Promise<void> {
  if (!w.websiteId || !w.anonymousId) return;

  /*
   * `os`, `region` and `language` have no columns, and `computed` is already spread
   * into the fact context — so they become facts here without a migration. It is also
   * the right home for them: they are derived from the request, not supplied by the
   * customer, which is what `properties` is for.
   */
  const computed = present({
    os: w.os,
    region: w.region,
    language: w.language,
  });

  const traits = present(w.traits ?? {});
  const pageViews = Math.max(0, Math.trunc(w.pageViews));
  const now = new Date();

  try {
    await db
      .insert(userProfiles)
      .values({
        websiteId: w.websiteId,
        anonymousId: w.anonymousId,
        userId: w.userId ?? null,
        properties: traits,
        computed,
        country: w.country ?? null,
        city: w.city ?? null,
        device: w.device ?? null,
        browser: w.browser ?? null,
        firstSeenAt: now,
        lastSeenAt: now,
        visitCount: 1,
        totalPageViews: pageViews,
      })
      .onConflictDoUpdate({
        target: [userProfiles.websiteId, userProfiles.anonymousId],
        set: {
          // Only advance the identity when this batch carried one.
          userId: w.userId
            ? w.userId
            : rawSql`${userProfiles.userId}`,
          properties: rawSql`${userProfiles.properties} || ${JSON.stringify(traits)}::jsonb`,
          computed: rawSql`${userProfiles.computed} || ${JSON.stringify(computed)}::jsonb`,
          country: rawSql`coalesce(${w.country ?? null}, ${userProfiles.country})`,
          city: rawSql`coalesce(${w.city ?? null}, ${userProfiles.city})`,
          device: rawSql`coalesce(${w.device ?? null}, ${userProfiles.device})`,
          browser: rawSql`coalesce(${w.browser ?? null}, ${userProfiles.browser})`,
          lastSeenAt: now,
          totalPageViews: rawSql`${userProfiles.totalPageViews} + ${pageViews}`,
          visitCount: rawSql`
            ${userProfiles.visitCount} + case
              when ${userProfiles.lastSeenAt} is null
                or ${userProfiles.lastSeenAt} < now() - interval '${rawSql.raw(String(VISIT_GAP_MINUTES))} minutes'
              then 1 else 0 end`,
          updatedAt: now,
        },
      });
  } catch (err) {
    log.warn({ msg: 'upsert_visitor_profile_failed', websiteId: w.websiteId, err });
  }
}
