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

let busy = false;
const waiting: Array<() => void> = [];

export async function withCaptureSlot<T>(capture: () => Promise<T>): Promise<T> {
  if (busy) {
    if (waiting.length >= MAX_WAITING) {
      throw new Error("Browser pool exhausted - screenshot queue is full");
    }
    // The releasing capture hands its slot straight to us, so `busy` stays true.
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    busy = true;
  }

  try {
    return await capture();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else busy = false;
  }
}
