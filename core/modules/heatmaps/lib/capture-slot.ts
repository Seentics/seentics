/**
 * Local Chromium captures run one at a time.
 *
 * `HeatmapAutoCapture` dedupes captures of the *same* page, but nothing stopped several
 * different pages from each launching a render at once — and every concurrent render is
 * another few hundred MB of Chromium. On a 4 GB server that is the likeliest way the whole
 * box runs out of memory. Serialising costs latency only: a queued capture waits its turn
 * instead of failing.
 *
 * The wait list is bounded so a burst cannot pile up unbounded pending work behind a slow
 * page. Past the bound the capture is refused with the "pool exhausted" message that
 * `captureAndStoreScreenshot` already treats as final, so a refusal is not retried.
 */
const MAX_WAITING = 20;

/**
 * Cloudflare renders concurrently on its side, so memory is not the constraint there — cost
 * and the account's browser quota are. Captures used to go straight to the REST endpoint
 * with no bound at all, so a burst of requests was a burst of billed renders (and 429s from
 * Cloudflare that failed every capture in the burst). A few at a time, same bounded wait list.
 */
const CLOUDFLARE_CONCURRENCY = 4;

/** A counting semaphore with a bounded FIFO wait list. */
export function createCaptureSlot(maxConcurrent: number, maxWaiting: number) {
  let running = 0;
  const waiting: Array<() => void> = [];

  return async function withSlot<T>(capture: () => Promise<T>): Promise<T> {
    if (running >= maxConcurrent) {
      if (waiting.length >= maxWaiting) {
        throw new Error("Browser pool exhausted - screenshot queue is full");
      }
      // The releasing capture hands its slot straight to us, so `running` is unchanged.
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else {
      running += 1;
    }

    try {
      return await capture();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running -= 1;
    }
  };
}

/** Local Chromium: one render at a time. */
export const withCaptureSlot = createCaptureSlot(1, MAX_WAITING);

/** Cloudflare Browser Rendering: a few renders at a time. */
export const withCloudflareCaptureSlot = createCaptureSlot(CLOUDFLARE_CONCURRENCY, MAX_WAITING);
