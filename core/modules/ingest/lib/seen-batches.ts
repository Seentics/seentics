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

/** For tests. */
export function resetSeenBatches(): void {
  seen.clear();
}

setInterval(() => {
  const cutoff = Date.now() - TTL_MS;
  for (const [k, at] of seen) {
    if (at >= cutoff) break; // insertion order is time order
    seen.delete(k);
  }
}, 5 * 60_000).unref?.();
