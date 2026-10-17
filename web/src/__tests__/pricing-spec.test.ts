import { describe, expect, it } from 'vitest';
import {
  COMPARE_GROUPS, FOUNDING_COUNT_SHOWN_FROM, FOUNDING_EMPHASIS_LEFT, FOUNDING_OFFER, OFFER_YEARLY, foundingNote, foundingPrice, TIER_PITCH, cardSectionsFor, freeMonths, maxYearlySaving, monthlyPrice,
  yearlySavingLabel, yearlySavingPercent, type PricedPlan,
} from '@/features/plans/pricing-spec';

/** The plans as gateway/db/sql/040_starter_plan_and_pro_24.sql leaves them. Starter's id and tier are `starter`. */
const FREE: PricedPlan = {
  tier: 'free', priceMonthly: 0, priceYearly: null,
  limits: {
    core: { monthly_events: 20_000, replays: 300, heatmaps: 3, funnels: 1, automations: 3, websites: -1, ai_analyses: 30, leads: 100, retention_days: 30, replay_retention_days: 30, conversion_destinations: 1 },
    observe: { storage_gb: 3, retention_days: 3 },
  },
};
const STARTER: PricedPlan = {
  tier: 'starter', priceMonthly: 9, priceYearly: 90,
  limits: {
    core: { monthly_events: 200_000, replays: 1_500, heatmaps: -1, funnels: -1, automations: -1, websites: -1, ai_analyses: 100, leads: 5_000, retention_days: 365, replay_retention_days: 30, conversion_destinations: 3 },
    observe: { storage_gb: 5, retention_days: 7 },
  },
};
const PRO: PricedPlan = {
  tier: 'pro', priceMonthly: 24, priceYearly: 240,
  limits: {
    core: { monthly_events: -1, included_monthly_events: 1_000_000, replays: -1, included_replays: 5_000, heatmaps: -1, funnels: -1, automations: -1, websites: -1, ai_analyses: 300, leads: 25_000, retention_days: 1095, replay_retention_days: 30, conversion_destinations: -1 },
    observe: { storage_gb: -1, included_storage_gb: 30, retention_days: 7 },
  },
};
/** Agency (gateway agent's catalogue): the top tier, metered like Pro, with the agency entitlement. */
const AGENCY: PricedPlan = {
  tier: 'agency', priceMonthly: 99, priceYearly: 990,
  limits: {
    core: {
      monthly_events: -1, included_monthly_events: 15_000_000, replays: -1, included_replays: 30_000, heatmaps: -1, funnels: -1, automations: -1,
      websites: -1, ai_analyses: 1000, leads: 200_000, retention_days: 1095, replay_retention_days: 90, conversion_destinations: -1, agency_features: 1,
    },
  },
};

const labels = (plan: PricedPlan) => cardSectionsFor(plan)[0]!.items.map((i) => `${i.value} ${i.label}`.trim());

describe('yearly pricing, offered on every paid plan', () => {
  it('is on', () => expect(OFFER_YEARLY).toBe(true));

  it('says "2 months free": $90, $240 and $990 against $9, $24 and $99 a month', () => {
    expect(freeMonths(STARTER)).toBe(2);
    expect(freeMonths(AGENCY)).toBe(2);
    expect(freeMonths(FREE)).toBe(0);
    expect(yearlySavingLabel([FREE, STARTER, PRO, AGENCY])).toBe('2 months free');
    expect(yearlySavingLabel(AGENCY)).toBe('2 months free');
    expect(monthlyPrice(AGENCY, 'year')).toBe(82.5);
    // A yearly price that isn't whole months falls back to the percentage.
    expect(yearlySavingLabel({ ...STARTER, priceYearly: 84 })).toBe('save 22%');
    expect(yearlySavingLabel(FREE)).toBe('');
  });

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
  it('Free: 300 recordings, 100 contacts and form submissions, and no Observability line', () => {
    const lines = labels(FREE);
    expect(lines).toContain('Up to 20K events');
    expect(lines).toContain('Up to 300 session recordings');
    expect(lines.join('\n')).not.toMatch(/logs, traces|GB/);
    expect(lines).toContain('100 contacts & form submissions a month');
    expect(lines).toContain('3 heatmaps, 1 funnel, 3 automations');
  });

  it('Starter: the whole product at smaller amounts, stopping at them', () => {
    const lines = labels(STARTER);
    expect(lines).toContain('Up to 200K events');
    expect(lines).toContain('Up to 1.5K session recordings');
    expect(lines).toContain('1 year analytics retention');
    expect(lines).toContain('Unlimited heatmaps, funnels, automations');
    expect(lines).toContain('5K contacts & form submissions a month');
    // A single-business plan: nothing of Agency's.
    expect(lines.join('\n')).not.toMatch(/Agency|client/i);
    expect(cardSectionsFor(STARTER)[1]!.items.map((i) => i.label)).toEqual(['Collection pauses at the limit', 'Move to Pro any time']);
  });

  it('Pro: the included amounts, and extra usage at a limit', () => {
    const [included, extra] = cardSectionsFor(PRO);
    const lines = included!.items.map((i) => `${i.value} ${i.label}`.trim());
    expect(lines).toContain('Up to 1M events');
    expect(lines).toContain('Up to 5K session recordings');
    expect(lines).toContain('Unlimited heatmaps, funnels, automations');
    expect(lines).toContain('25K contacts & form submissions a month');
    expect(lines.join('\n')).not.toMatch(/logs, traces|client/i);
    expect(extra!.items.map((i) => i.label)).toEqual(['Pauses, or keep going with Extra usage', 'Move to Agency any time']);
    expect(JSON.stringify(cardSectionsFor(PRO))).not.toMatch(/per 1K|per GB|spend cap/);
  });

  it('Agency: the agency copy, client access on your own domain, and overage at the limit', () => {
    expect(TIER_PITCH.agency).toBe('For agencies managing multiple client sites');
    const [included, past] = cardSectionsFor(AGENCY);
    const lines = labels(AGENCY);
    expect(lines).toContain('Up to 15M events');
    expect(lines).toContain('Up to 30K session recordings');
    expect(lines).toContain('Unlimited client workspaces and websites');
    expect(lines).toContain('Unlimited heatmaps, funnels, automations');
    expect(lines).toContain('Unlimited ad platforms for server-side conversions');
    expect(lines).toContain('200K contacts & form submissions a month');
    expect(lines).toContain('1K AI analyses');
    expect(lines).toContain('3 years analytics retention, 90 days replay retention');
    expect(lines).toContain('Priority support and personal onboarding');
    expect(included!.items.map((i) => i.label)).toContain('Client access and white-label reports on your own domain');
    expect(JSON.stringify(cardSectionsFor(AGENCY))).not.toMatch(/soon/i);
    expect(past!.items.map((i) => i.label)).toEqual(['Overage instead of pausing, with Extra usage', 'An alert at 80% of each allowance']);
  });

  it('keeps the founding code in one place', () => {
    expect(FOUNDING_OFFER).toEqual({ code: 'FOUNDING30', percentOff: 30, plans: ['pro', 'agency'], seats: 50 });
  });

  it('takes 30% off the plan prices for the founding price, to the cent', () => {
    expect(foundingPrice(PRO, 'month')).toBe(16.8);
    expect(foundingPrice(PRO, 'year')).toBe(168);
    expect(foundingPrice(AGENCY, 'month')).toBe(69.3);
    expect(foundingPrice(AGENCY, 'year')).toBe(693);
  });
});

describe('founding spots left', () => {
  const spots = (claimed: number | null, total = 50, status: 'open' | 'closed' = 'open') =>
    ({ total, claimed, left: claimed === null ? null : Math.max(0, total - claimed), status });

  it('shows the count only from 10 claims, and emphasises it at 5 left or fewer', () => {
    expect(FOUNDING_COUNT_SHOWN_FROM).toBe(10);
    expect(FOUNDING_EMPHASIS_LEFT).toBe(5);
  });

  it('an unknown count, or no answer at all, shows only the limit', () => {
    const limitOnly = { show: true, text: 'Limited to the first 50 customers', emphasised: false };
    expect(foundingNote(spots(null))).toEqual(limitOnly);
    expect(foundingNote(undefined)).toEqual(limitOnly);
    expect(foundingNote(null)).toEqual(limitOnly);
  });

  it('fewer than 10 claims shows only the limit, from the discount\'s total', () => {
    expect(foundingNote(spots(0))).toEqual({ show: true, text: 'Limited to the first 50 customers', emphasised: false });
    expect(foundingNote(spots(9, 40))).toEqual({ show: true, text: 'Limited to the first 40 customers', emphasised: false });
  });

  it('from 10 claims, the spots left', () => {
    expect(foundingNote(spots(10))).toEqual({ show: true, text: 'Only 40 of 50 founding spots left', emphasised: false });
    expect(foundingNote(spots(44))).toEqual({ show: true, text: 'Only 6 of 50 founding spots left', emphasised: false });
  });

  it('5 spots left or fewer is emphasised', () => {
    expect(foundingNote(spots(45))).toEqual({ show: true, text: 'Only 5 of 50 founding spots left', emphasised: true });
    expect(foundingNote(spots(49))).toEqual({ show: true, text: 'Only 1 of 50 founding spots left', emphasised: true });
  });

  it('a closed offer, or none left, hides the box', () => {
    expect(foundingNote(spots(50, 50, 'closed'))).toEqual({ show: false });
    expect(foundingNote(spots(3, 50, 'closed'))).toEqual({ show: false });
    expect(foundingNote(spots(50))).toEqual({ show: false });
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
    expect(cell('Contacts & form submissions / month', STARTER)).toBe('Up to 5K');
    expect(cell('Contacts & form submissions / month', { ...STARTER, limits: { ...STARTER.limits, core: { ...STARTER.limits.core, leads: 0 } } })).toBe(false);
  });

  it('has no Observability section (not marketed), and no uptime row', () => {
    expect(COMPARE_GROUPS.map((g) => g.title)).not.toContain('Observability');
    const rows = COMPARE_GROUPS.flatMap((g) => g.rows).map((r) => r.label).join('\n');
    expect(rows).not.toMatch(/Uptime|Logs, traces|Telemetry/);
  });

  it('shows the agency features as Agency only', () => {
    for (const plan of [FREE, STARTER, PRO]) {
      expect(cell('Client workspaces', plan)).toBe(false);
      expect(cell('Embedded client dashboards', plan)).toBe(false);
      expect(cell('Client access & white-label reports', plan)).toBe(false);
    }
    expect(cell('Client workspaces', AGENCY)).toBe('Unlimited');
    expect(cell('Embedded client dashboards', AGENCY)).toBe(true);
    expect(cell('Client access & white-label reports', AGENCY)).toBe(true);
    // Account keys stay on every plan.
    expect(cell('API access with account keys', FREE)).toBe(true);
    expect(cell('Support', AGENCY)).toBe('Priority, with onboarding');
    expect(cell('Support', PRO)).toBe('Email');
  });

  it('states events and retention for every plan', () => {
    expect(cell('Events / month', STARTER)).toBe('Up to 200K');
    expect(cell('Events / month', PRO)).toBe('Up to 1M');
    expect(cell('Data retention', STARTER)).toBe('1 year');
    expect(cell('Data retention', PRO)).toBe('3 years');
  });

  it('extra usage is a Pro and Agency option', () => {
    expect(cell('Monthly spend cap on extra usage', PRO)).toBe(true);
    expect(cell('Monthly spend cap on extra usage', AGENCY)).toBe(true);
    expect(cell('Monthly spend cap on extra usage', STARTER)).toBe(false);
    expect(cell('Past the limit', STARTER)).toBe('Collection pauses');
    expect(cell('Past the limit', PRO)).toBe('Pauses, or extra usage at $0.01 / 1K');
    expect(cell('Past the limit', AGENCY)).toBe('Extra usage at $0.01 / 1K, alert at 80%');
  });
});

describe('a plan with no Observability allowance (an older catalogue)', () => {
  const noObserve: PricedPlan = { ...STARTER, limits: { core: STARTER.limits.core } };
  const cell = (label: string) => COMPARE_GROUPS.flatMap((g) => g.rows).find((r) => r.label === label)!.value(noObserve);

  it('renders the same card and table, never "undefined"', () => {
    expect(JSON.stringify(cardSectionsFor(noObserve))).not.toContain('undefined');
    expect(labels(noObserve)).toEqual(labels(STARTER));
    expect(cell('Events / month')).toBe('Up to 200K');
  });
});

describe('server-side conversions on the plans', () => {
  const cell = (plan: PricedPlan) => COMPARE_GROUPS.flatMap((g) => g.rows).find((r) => r.label === 'Server-side conversions (Meta, GA4, TikTok, LinkedIn)')!.value(plan);
  it('says how many ad platforms each plan sends to', () => {
    expect(labels(FREE)).toContain('1 ad platform for server-side conversions');
    expect(labels(STARTER)).toContain('3 ad platforms for server-side conversions');
    expect(labels(PRO)).toContain('Unlimited ad platforms for server-side conversions');
    expect(cell(STARTER)).toBe('3 ad platforms');
    expect(cell(PRO)).toBe('Unlimited ad platforms');
  });
  it('leaves the line out for a catalogue that does not state it', () => {
    const old: PricedPlan = { ...STARTER, limits: { ...STARTER.limits, core: { ...STARTER.limits.core, conversion_destinations: undefined as never } } };
    delete (old.limits.core as Record<string, unknown>).conversion_destinations;
    expect(labels(old).join('\n')).not.toMatch(/ad platform/);
    expect(cell(old)).toBe(false);
  });
});
