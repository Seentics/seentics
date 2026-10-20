import type { ManualPaymentMethod } from '@/lib/i18n/region';

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

/**
 * Paying in taka (Bangladesh): an invoice the customer pays with bKash, Nagad or Rocket, then
 * verified by us, which turns the plan on (gateway's /user/billing/invoices).
 */
export type InvoiceStatus = 'open' | 'submitted' | 'paid' | 'rejected' | 'void';

export type Invoice = {
  id: string;
  /** What the customer writes as the payment's reference, e.g. SN-2610-0001. */
  number: string;
  planId: string;
  planName: string;
  interval: 'month' | 'year';
  /** Whole taka. */
  amountBdt: number;
  status: InvoiceStatus;
  /** `renewal`: issued before a paid period ends, to carry the plan on. */
  kind: 'new' | 'renewal';
  periodStart: string | null;
  periodEnd: string | null;
  dueAt: string;
  paymentMethod: string | null;
  payerNumber: string | null;
  transactionId: string | null;
  submittedAt: string | null;
  paidAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  /**
   * Where to send the money, when the gateway includes it with the invoice. The invoice page falls
   * back to GET /billing/region's, which is only given to visitors in Bangladesh.
   */
  payTo?: { accountName: string | null; methods: ManualPaymentMethod[] } | null;
};

/**
 * The plan paid for in taka. `past_due`: the paid period has ended and the renewal is unpaid; the
 * plan keeps running until `graceEndsAt`, then the account moves to Free.
 */
export type ManualSubscription = {
  planId: string;
  planName: string;
  interval: 'month' | 'year';
  status: 'active' | 'past_due';
  currentPeriodEnd: string;
  graceEndsAt: string;
};

export type PaymentDetails = {
  method: 'bkash' | 'nagad' | 'rocket';
  /** The number the money was sent from, 01XXXXXXXXX. */
  payerNumber: string;
  transactionId: string;
};
