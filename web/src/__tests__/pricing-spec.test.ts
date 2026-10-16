import { describe, expect, it } from 'vitest';
import {
  COMPARE_GROUPS, cardSectionsFor, maxYearlySaving, monthlyPrice, yearlySavingPercent, type PricedPlan,
} from '@/features/plans/pricing-spec';

/** The plans as gateway/db/sql/040_starter_plan_and_pro_24.sql leaves them. Starter keeps the `analytics` tier. */
const FREE: PricedPlan = {
  tier: 'free', priceMonthly: 0, priceYearly: null,
  limits: {
    core: { monthly_events: 20_000, replays: 300, heatmaps: 3, funnels: 1, automations: 3, websites: -1, ai_analyses: 30, leads: 100, retention_days: 30, replay_retention_days: 30 },
    observe: { storage_gb: 3, retention_days: 3 },
  },
};
const STARTER: PricedPlan = {
  tier: 'analytics', priceMonthly: 9, priceYearly: 90,
  limits: {
    core: { monthly_events: 200_000, replays: 1_500, heatmaps: -1, funnels: -1, automations: -1, websites: -1, ai_analyses: 100, leads: 2_500, retention_days: 365, replay_retention_days: 30 },
    observe: { storage_gb: 5, retention_days: 7 },
  },
};
const PRO: PricedPlan = {
  tier: 'pro', priceMonthly: 24, priceYearly: 240,
  limits: {
    core: { monthly_events: -1, included_monthly_events: 1_000_000, replays: -1, included_replays: 5_000, heatmaps: -1, funnels: -1, automations: -1, websites: -1, ai_analyses: 300, leads: 25_000, retention_days: 1095, replay_retention_days: 30 },
    observe: { storage_gb: -1, included_storage_gb: 30, retention_days: 7 },
  },
};

const labels = (plan: PricedPlan) => cardSectionsFor(plan)[0]!.items.map((i) => `${i.value} ${i.label}`.trim());

describe('yearly pricing (priced, not yet offered: OFFER_YEARLY)', () => {
  it('shows the year\'s price as a monthly figure: $7.50 and $20', () => {
    expect(monthlyPrice(STARTER, 'month')).toBe(9);
    expect(monthlyPrice(STARTER, 'year')).toBe(7.5);
    expect(monthlyPrice(PRO, 'month')).toBe(24);
    expect(monthlyPrice(PRO, 'year')).toBe(20);
    // Free has no yearly price, so it stays $0.
    expect(monthlyPrice(FREE, 'year')).toBe(0);
  });

  it('works out the saving: two months free is 17%', () => {
    expect(yearlySavingPercent(STARTER)).toBe(17);
    expect(yearlySavingPercent(PRO)).toBe(17);
    expect(yearlySavingPercent(FREE)).toBe(0);
    expect(maxYearlySaving([FREE, STARTER, PRO])).toBe(17);
    expect(maxYearlySaving([])).toBe(0);
  });
});

describe('pricing cards', () => {
  it('Free: 300 recordings, 3 GB of telemetry, 100 form submissions', () => {
    const lines = labels(FREE);
    expect(lines).toContain('Up to 20K events');
    expect(lines).toContain('Up to 300 session recordings');
    expect(lines).toContain('Up to 3 GB logs, traces & metrics');
    expect(lines).toContain('100 form submissions a month');
    expect(lines).toContain('3 heatmaps, 1 funnel, 3 automations');
  });

  it('Starter: the whole product at smaller amounts, stopping at them', () => {
    const lines = labels(STARTER);
    expect(lines).toContain('Up to 200K events');
    expect(lines).toContain('Up to 1.5K session recordings');
    expect(lines).toContain('Up to 5 GB logs, traces & metrics');
    expect(lines).toContain('1 year analytics retention');
    expect(lines).toContain('Unlimited heatmaps, funnels, automations');
    expect(lines).toContain('2.5K form submissions a month');
    expect(lines).toContain('Agency: clients, APIs & embeds');
    expect(cardSectionsFor(STARTER)[1]!.items.map((i) => i.label)).toEqual(['Collection pauses at the limit', 'Move to Pro any time']);
  });

  it('Pro: the included amounts, and the extra usage rates', () => {
    const [included, extra] = cardSectionsFor(PRO);
    const lines = included!.items.map((i) => `${i.value} ${i.label}`.trim());
    expect(lines).toContain('Up to 1M events');
    expect(lines).toContain('Up to 5K session recordings');
    expect(lines).toContain('Up to 30 GB logs, traces & metrics');
    expect(lines).toContain('Unlimited heatmaps, funnels, automations');
    expect(lines).toContain('25K form submissions a month');
    // Extra usage is not spelled out on the card: a bigger need is a conversation.
    expect(extra!.title).toBe('Need more?');
    expect(extra!.items).toEqual([{ value: '', label: 'Contact us for a custom plan', href: '/contact' }]);
    expect(JSON.stringify(cardSectionsFor(PRO))).not.toMatch(/per 1K|per GB|spend cap/);
  });
});

describe('comparison table', () => {
  const cell = (label: string, plan: PricedPlan) => COMPARE_GROUPS.flatMap((g) => g.rows).find((r) => r.label === label)!.value(plan);

  it('shows a dash (false) where a plan has none of it, and a number where it does', () => {
    expect(cell('Recordings / month', FREE)).toBe('Up to 300');
    expect(cell('Recordings / month', STARTER)).toBe('Up to 1.5K');
    expect(cell('Recordings / month', PRO)).toBe('Up to 5K');
    expect(cell('Heatmaps', FREE)).toBe('3 pages');
    expect(cell('Heatmaps', STARTER)).toBe('Unlimited');
    expect(cell('Popups & forms', STARTER)).toBe('2.5K submissions / mo');
    expect(cell('Popups & forms', { ...STARTER, limits: { ...STARTER.limits, core: { ...STARTER.limits.core, leads: 0 } } })).toBe(false);
    expect(cell('Logs, traces & metrics / month', STARTER)).toBe('Up to 5 GB');
    expect(cell('Logs, traces & metrics / month', PRO)).toBe('Up to 30 GB');
    // Every plan has the whole product now: observability's features are on every plan.
    expect(cell('Error tracking & alerts', STARTER)).toBe(true);
  });

  it('states events and retention for every plan', () => {
    expect(cell('Events / month', STARTER)).toBe('Up to 200K');
    expect(cell('Events / month', PRO)).toBe('Up to 1M');
    expect(cell('Data retention', STARTER)).toBe('1 year');
    expect(cell('Data retention', PRO)).toBe('3 years');
  });

  it('extra usage is a Pro option only', () => {
    expect(cell('Monthly spend cap on extra usage', PRO)).toBe(true);
    expect(cell('Monthly spend cap on extra usage', STARTER)).toBe(false);
    expect(cell('Past the limit', STARTER)).toBe('Collection pauses');
  });
});

describe('a plan with no Observability allowance (an older catalogue)', () => {
  const noObserve: PricedPlan = { ...STARTER, limits: { core: STARTER.limits.core } };
  const cell = (label: string) => COMPARE_GROUPS.flatMap((g) => g.rows).find((r) => r.label === label)!.value(noObserve);

  it('leaves the telemetry line off the card and dashes the table, never "undefined"', () => {
    expect(JSON.stringify(cardSectionsFor(noObserve))).not.toContain('undefined');
    expect(labels(noObserve).join('\n')).not.toMatch(/logs, traces/);
    expect(cell('Logs, traces & metrics / month')).toBe(false);
    expect(cell('Telemetry retention')).toBe(false);
  });
});
