import { describe, expect, it } from 'vitest';
import {
  COMPARE_GROUPS, cardSectionsFor, maxYearlySaving, monthlyPrice, yearlySavingPercent, type PricedPlan,
} from '@/features/plans/pricing-spec';

/** The plans as gateway/db/sql/035_analytics_plan_and_yearly_billing.sql seeds them. */
const FREE: PricedPlan = {
  tier: 'free', priceMonthly: 0, priceYearly: null,
  limits: {
    core: { monthly_events: 20_000, replays: 300, heatmaps: 3, funnels: 1, automations: 3, websites: -1, ai_analyses: 30, leads: 100, retention_days: 30, replay_retention_days: 30 },
    observe: { storage_gb: 3, retention_days: 3 },
  },
};
const ANALYTICS: PricedPlan = {
  tier: 'analytics', priceMonthly: 9, priceYearly: 84,
  limits: {
    core: { monthly_events: 500_000, replays: 0, heatmaps: 0, funnels: -1, automations: 0, websites: -1, ai_analyses: 50, leads: 0, retention_days: 1095, replay_retention_days: 30 },
  },
};
const PRO: PricedPlan = {
  tier: 'pro', priceMonthly: 19, priceYearly: 168,
  limits: {
    core: { monthly_events: -1, included_monthly_events: 1_000_000, replays: -1, included_replays: 5_000, heatmaps: -1, funnels: -1, automations: -1, websites: -1, ai_analyses: 300, leads: 25_000, retention_days: 1095, replay_retention_days: 30 },
    observe: { storage_gb: -1, included_storage_gb: 30, retention_days: 7 },
  },
};

const labels = (plan: PricedPlan) => cardSectionsFor(plan)[0]!.items.map((i) => `${i.value} ${i.label}`.trim());

describe('yearly pricing', () => {
  it('shows the year\'s price as a monthly figure: $7 and $14', () => {
    expect(monthlyPrice(ANALYTICS, 'month')).toBe(9);
    expect(monthlyPrice(ANALYTICS, 'year')).toBe(7);
    expect(monthlyPrice(PRO, 'month')).toBe(19);
    expect(monthlyPrice(PRO, 'year')).toBe(14);
    // Free has no yearly price, so it stays $0.
    expect(monthlyPrice(FREE, 'year')).toBe(0);
  });

  it('works out the saving: about 22% on Analytics and 26% on Pro', () => {
    expect(yearlySavingPercent(ANALYTICS)).toBe(22);
    expect(yearlySavingPercent(PRO)).toBe(26);
    expect(yearlySavingPercent(FREE)).toBe(0);
    expect(maxYearlySaving([FREE, ANALYTICS, PRO])).toBe(26);
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

  it('Analytics: 500K events and analytics, with nothing it does not have: no recordings, telemetry, heatmaps or submissions', () => {
    const lines = labels(ANALYTICS);
    expect(lines).toContain('Up to 500K events');
    expect(lines).toContain('3 years analytics retention');
    expect(lines).toContain('Goals and unlimited funnels');
    expect(lines).toContain('API access');
    expect(lines.join('\n')).not.toMatch(/recording|logs, traces|heatmap|automation|submissions/i);
    expect(cardSectionsFor(ANALYTICS)[1]!.items.map((i) => i.label).join('\n')).toContain('Need replay or heatmaps? Go Pro');
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
    expect(cell('Recordings / month', ANALYTICS)).toBe(false);
    expect(cell('Recordings / month', FREE)).toBe('Up to 300');
    expect(cell('Recordings / month', PRO)).toBe('Up to 5K');
    expect(cell('Heatmaps', ANALYTICS)).toBe(false);
    expect(cell('Automations', ANALYTICS)).toBe(false);
    expect(cell('Popups & forms', ANALYTICS)).toBe(false);
    expect(cell('Popups & forms', PRO)).toBe('25K submissions / mo');
    expect(cell('Logs, traces & metrics / month', ANALYTICS)).toBe(false);
    expect(cell('Logs, traces & metrics / month', PRO)).toBe('Up to 30 GB');
  });

  it('states events and retention for every plan', () => {
    expect(cell('Events / month', ANALYTICS)).toBe('Up to 500K');
    expect(cell('Events / month', PRO)).toBe('Up to 1M');
    expect(cell('Data retention', ANALYTICS)).toBe('3 years');
    expect(cell('Data retention', PRO)).toBe('3 years');
  });

  it('extra usage is a Pro option only', () => {
    expect(cell('Monthly spend cap on extra usage', PRO)).toBe(true);
    expect(cell('Monthly spend cap on extra usage', ANALYTICS)).toBe(false);
  });
});
