/** gateway GET /user/billing/meter: a Pay-As-You-Go account's current period (gateway/billing/metering.ts). */
export type MeterState = {
  period: { start: string; end: string } | null;
  used: { events: number; replays: number; observeBytes: number };
  included: { events: number; replays: number; observeGb: number };
  overage: {
    events: number;
    replays: number;
    observeBytes: number;
    /** In credits, $0.01 each. */
    credits: { events: number; replays: number; observe: number; total: number };
  };
  baseCents: number;
  /** Overage billed so far: its cost, bounded by the spend cap. */
  billableCents: number;
  /** The whole monthly bill's ceiling; null when none is set. */
  spendCapCents: number | null;
  /** The cap is reached: usage past the included amounts is not being collected. */
  paused: boolean;
  measuredAt: string;
};
