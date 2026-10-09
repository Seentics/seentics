/**
 * Demo data for billing: an account on Pay-As-You-Go two-thirds of the way through its period, past
 * its included events, inside its included recordings and observability, with a spend cap set.
 */
import type { MeterState } from '@/features/billing/types';

const DAY = 86_400_000;
const GB = 1024 ** 3;
const day = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

export const demoSubscription = () => ({
  id: 'demo-user',
  plan: 'Pay-As-You-Go',
  planId: 'payg',
  status: 'active',
  priceMonthly: 15,
  currentPeriodEnd: new Date(Date.now() + 10 * DAY).toISOString(),
  cancelAtPeriodEnd: false,
  usage: {
    websites: { current: 6, limit: -1, canCreate: true },
    workflows: { current: 4, limit: -1, canCreate: true },
    funnels: { current: 2, limit: -1, canCreate: true },
    heatmaps: { current: 9, limit: -1, canCreate: true },
    replays: { current: 2_140, limit: -1, canCreate: true },
    monthlyEvents: { current: 742_300, limit: -1, canCreate: true },
    aiAnalyses: { current: 41, limit: 300, canCreate: true },
  },
  features: [],
  isActive: true,
});

export const demoMeter = (): MeterState => ({
  period: { start: day(-20), end: day(10) },
  used: { events: 742_300, replays: 2_140, observeBytes: 6.4 * GB },
  included: { events: 500_000, replays: 3_000, observeGb: 10 },
  overage: {
    events: 242_300,
    replays: 0,
    observeBytes: 0,
    credits: { events: 242, replays: 0, observe: 0, total: 242 },
  },
  baseCents: 1_500,
  billableCents: 242,
  spendCapCents: 5_000,
  paused: false,
  measuredAt: new Date().toISOString(),
});
