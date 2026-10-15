/**
 * Tracker batches already stored, so a retry is not stored twice.
 *
 * The tracker retries a send whose answer it did not get — but the server may have stored it
 * and only the answer was lost (a slow mobile network, a closing tab). Each drained batch carries
 * a random `batch_id` that every retry repeats; one seen in the last hour is answered as accepted
 * and not processed again. Retries come within minutes, so an hour is plenty.
 *
 * Process-local: correct while one API process takes tracker traffic, as it does. Bounded, so a
 * flood of ids cannot grow it without end — the oldest are forgotten first.
 */
const TTL_MS = 60 * 60_000;
const MAX = 200_000;
const seen = new Map<string, number>();

export function alreadyStored(websiteId: string, batchId: unknown, now = Date.now()): boolean {
  if (typeof batchId !== "string" || !batchId) return false;
  const fresh = (id: string) => { const at = seen.get(`${websiteId}|${id}`); return at !== undefined && now - at < TTL_MS; };
  if (fresh(batchId)) return true;
  // A piece of a batch split while its page closed (`<batch>#<piece>`): a repeat when the whole
  // batch already arrived.
  const hash = batchId.indexOf("#");
  return hash > 0 && fresh(batchId.slice(0, hash));
}

export function markStored(websiteId: string, batchId: unknown, now = Date.now()): void {
  if (typeof batchId !== "string" || !batchId) return;
  if (seen.size >= MAX) seen.delete(seen.keys().next().value!);
  seen.set(`${websiteId}|${batchId}`, now);
}

/**
 * Heatmap events already taken, by the `event_id` the tracker gives each click and each page
 * view's scroll summary. When a page closes, batches still in flight are sent again in pieces
 * (seentics.js flushBeacon); a piece of one that had already arrived used to count its clicks
 * twice. Keyed per site; same hour and bound as the batches.
 */
const seenEvents = new Map<string, number>();

/** True the first time an id is offered (and remembers it); false for a repeat within the hour. */
export function firstHeatmapSighting(websiteId: string, eventId: unknown, now = Date.now()): boolean {
  if (typeof eventId !== "string" || !eventId) return true; // nothing to tell it by: keep it
  const key = `${websiteId}|${eventId}`;
  const at = seenEvents.get(key);
  if (at !== undefined && now - at < TTL_MS) return false;
  if (seenEvents.size >= MAX * 5) seenEvents.delete(seenEvents.keys().next().value!);
  seenEvents.set(key, now);
  return true;
}

/** For tests. */
export function resetSeenBatches(): void {
  seen.clear();
  seenEvents.clear();
}

setInterval(() => {
  const cutoff = Date.now() - TTL_MS;
  for (const [k, at] of seen) {
    if (at >= cutoff) break; // insertion order is time order
    seen.delete(k);
  }
  for (const [k, at] of seenEvents) {
    if (at >= cutoff) break;
    seenEvents.delete(k);
  }
}, 5 * 60_000).unref?.();
