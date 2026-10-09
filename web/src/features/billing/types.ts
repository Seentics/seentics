/**
 * gateway GET /user/billing/meter: Extra usage's current period on a Pro account
 * (gateway/billing/metering.ts). Null when Extra usage is off.
 */
export type MeterState = {
  period: { start: string; end: string } | null;
  used: { events: number; replays: number; observeBytes: number };
  /** Pro's included amounts: only usage past these is billed. */
  included: { events: number; replays: number; observeGb: number };
  overage: {
    events: number;
    replays: number;
    observeBytes: number;
    /** In credits, $0.01 each. */
    credits: { events: number; replays: number; observe: number; total: number };
  };
  /** Extra usage billed so far this period: its cost, bounded by the spend cap. */
  billableCents: number;
  /** The most extra usage can cost in a month; null when there is no cap. */
  spendCapCents: number | null;
  /** The cap is reached: usage past the included amounts is not being collected. */
  paused: boolean;
  measuredAt: string;
};
