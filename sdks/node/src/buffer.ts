type Sender<T> = (items: T[]) => Promise<void>;

export class FlushBuffer<T> {
  private items: T[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly send: Sender<T>,
    private readonly maxSize: number,
    intervalMs: number,
  ) {
    const t = setInterval(() => { void this._flush(); }, intervalMs);
    // Don't keep the Node.js process alive solely because of this timer.
    if (t && typeof (t as NodeJS.Timeout).unref === 'function') {
      (t as NodeJS.Timeout).unref();
    }
    this.timer = t;
  }

  add(item: T): void {
    this.items.push(item);
    if (this.items.length >= this.maxSize) void this._flush();
  }

  private async _flush(): Promise<void> {
    if (this.items.length === 0) return;
    const batch = this.items.splice(0);
    try { await this.send(batch); } catch { /* swallow — no context to surface to */ }
  }

  async flush(): Promise<void> {
    await this._flush();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}
