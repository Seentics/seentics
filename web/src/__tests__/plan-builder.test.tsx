import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plan } from '@/features/plans/types';

let plans: Plan[] = [
  { id: 'free', name: 'Free', tier: 'free', description: null, priceMonthly: 0, priceYearly: null, products: ['core', 'observe'], features: [],
    limits: { core: { monthly_events: 20_000, replays: 300, heatmaps: 3, funnels: 1, automations: 3, websites: -1, ai_analyses: 30, leads: 100, retention_days: 30 }, observe: { storage_gb: 3 } } },
  { id: 'starter', name: 'Starter', tier: 'starter', description: null, priceMonthly: 9, priceYearly: 90, products: ['core', 'observe'], features: [],
    limits: { core: { monthly_events: 200_000, replays: 1_500, heatmaps: -1, funnels: -1, automations: -1, websites: -1, ai_analyses: 100, leads: 5_000, retention_days: 365 }, observe: { storage_gb: 5 } } },
  { id: 'pro', name: 'Pro', tier: 'pro', description: null, priceMonthly: 24, priceYearly: 240, products: ['core', 'observe'], features: [],
    limits: { core: { monthly_events: -1, included_monthly_events: 1_000_000, replays: -1, included_replays: 5_000, heatmaps: -1, funnels: -1, automations: -1, websites: -1, ai_analyses: 300, leads: 25_000, retention_days: 1095 }, observe: { storage_gb: -1, included_storage_gb: 30 } } },
  { id: 'agency', name: 'Agency', tier: 'agency', description: 'For agencies managing multiple client sites', priceMonthly: 99, priceYearly: 990, products: ['core', 'observe'], features: [],
    limits: { core: { monthly_events: -1, included_monthly_events: 15_000_000, replays: -1, included_replays: 30_000, heatmaps: -1, funnels: -1, automations: -1, websites: -1, ai_analyses: 1000, leads: 200_000, retention_days: 1095, replay_retention_days: 90, conversion_destinations: -1, agency_features: 1 } } },
];

const original = plans;
vi.mock('@/features/plans/queries', () => ({ usePlans: () => ({ data: plans, isLoading: false, isError: false }) }));

const { PlanBuilder } = await import('@/components/subscription/PlanBuilder');

beforeEach(() => { vi.clearAllMocks(); plans = original; });

const monthly = () => fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
const yearly = () => fireEvent.click(screen.getByRole('button', { name: 'Yearly (2 months free)' }));

describe('PlanBuilder', () => {
  it('shows Free, Starter, Pro and Agency, monthly by default, yearly with "2 months free"', () => {
    render(<PlanBuilder />);
    for (const name of ['Free', 'Starter', 'Pro', 'Agency']) expect(screen.getByRole('heading', { name })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Monthly' }).getAttribute('aria-pressed')).toBe('true');
    yearly();
    expect(screen.getByRole('button', { name: 'Yearly (2 months free)' }).getAttribute('aria-pressed')).toBe('true');
    // $90, $240 and $990 a year, shown a month at a time.
    expect(screen.getByText('$7.50')).toBeTruthy();
    expect(screen.getByText('$20')).toBeTruthy();
    expect(screen.getByText('$82.50')).toBeTruthy();
    // One short line per card; the saving is said once, on the toggle, and no price is struck out.
    expect(screen.getByText('$990 billed yearly')).toBeTruthy();
    expect(screen.getByText('$90 billed yearly')).toBeTruthy();
    expect(screen.queryByText(/months free/, { selector: 'p' })).toBeNull();
    expect(screen.queryByText('$9')).toBeNull();
  });

  it('switches back to monthly prices with the toggle', () => {
    render(<PlanBuilder />);
    yearly();
    monthly();
    expect(screen.getByRole('button', { name: 'Monthly' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('$9')).toBeTruthy();
    expect(screen.getByText('$24')).toBeTruthy();
    expect(screen.getByText('$99')).toBeTruthy();
    expect(screen.getAllByText('Billed monthly')).toHaveLength(3);
  });

  it('hands the chosen plan and interval to onSubscribe (founding offer closed)', () => {
    const onSubscribe = vi.fn();
    render(<PlanBuilder onSubscribe={onSubscribe} founding={{ code: 'FOUNDING30', total: 50, claimed: 50, left: 0, status: 'closed' }} />);
    yearly();
    fireEvent.click(screen.getByRole('button', { name: /Get Agency/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'agency', price: 82.5, interval: 'year' });
    monthly();
    fireEvent.click(screen.getByRole('button', { name: /Get Pro/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'pro', price: 24, interval: 'month' });
    fireEvent.click(screen.getByRole('button', { name: /Get Starter/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'starter', price: 9, interval: 'month' });
    fireEvent.click(screen.getByRole('button', { name: /Start free/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'free', price: 0, interval: 'month' });
  });

  it('marks the current plan', () => {
    render(<PlanBuilder currentPlan="pro" currentInterval="month" />);
    expect((screen.getByRole('button', { name: 'Current plan' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Get Starter/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the whole product on the Starter card, and agency features only on Agency', () => {
    render(<PlanBuilder />);
    expect(screen.getByText('Move to Pro any time')).toBeTruthy();
    expect(screen.getAllByText('heatmaps, funnels, automations').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('client workspaces')).toHaveLength(1);
    expect(screen.getAllByText('Agency features')).toHaveLength(1);
    expect(screen.queryByText(/Agency: client/)).toBeNull();
    expect(screen.queryByText(/logs, traces/)).toBeNull();
  });
});

describe('the Agency card', () => {
  it('has its badge, pitch, and its features with what is not live yet marked Soon', () => {
    render(<PlanBuilder />);
    expect(screen.getByText('For agencies')).toBeTruthy();
    expect(screen.getByText('Most popular')).toBeTruthy();
    expect(screen.getByText('For agencies managing multiple client sites')).toBeTruthy();
    expect(screen.getByText('White-label branding: your logo, colours and name').parentElement!.textContent).not.toContain('Soon');
    expect(screen.getByText('Client dashboards on your own domain').parentElement!.textContent).toContain('Soon');
    expect(screen.getByText('Client sign-in with pages you choose').parentElement!.textContent).toContain('Soon');
  });
});

describe('the founding offer', () => {
  const banner = () => screen.getByTestId('founding-offer');

  it('is one short line above the cards, with no buttons of its own', () => {
    render(<PlanBuilder onSubscribe={vi.fn()} />);
    expect(screen.getAllByTestId('founding-offer')).toHaveLength(1);
    expect(banner().textContent).toBe('Founding offer: 30% off Pro and Agency for life with code FOUNDING30 · first 50 customers');
    expect(banner().querySelector('button')).toBeNull();
    for (const heading of screen.getAllByRole('heading', { level: 3 })) {
      expect(heading.closest('.rounded-2xl')?.textContent ?? '').not.toContain('FOUNDING30');
    }
  });

  it('is applied by Get Pro and Get Agency on the selected interval, never to Starter', () => {
    const onSubscribe = vi.fn();
    render(<PlanBuilder onSubscribe={onSubscribe} />);
    yearly();
    fireEvent.click(screen.getByRole('button', { name: /Get Agency/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'agency', price: 57.75, interval: 'year', discount: 'FOUNDING30' });
    fireEvent.click(screen.getByRole('button', { name: /Get Pro/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'pro', price: 14, interval: 'year', discount: 'FOUNDING30' });
    fireEvent.click(screen.getByRole('button', { name: /Get Starter/ }));
    expect(onSubscribe.mock.lastCall![0]).not.toHaveProperty('discount');
    monthly();
    fireEvent.click(screen.getByRole('button', { name: /Get Pro/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'pro', price: 16.8, interval: 'month', discount: 'FOUNDING30' });
  });

  const spots = (claimed: number | null, status: 'open' | 'closed' = 'open') =>
    ({ code: 'FOUNDING30', total: 50, claimed, left: claimed === null ? null : Math.max(0, 50 - claimed), status });
  const note = () => screen.getByTestId('founding-spots');

  it('with an unknown or small count, says only that it is limited', () => {
    for (const founding of [undefined, spots(null), spots(9)]) {
      const { unmount } = render(<PlanBuilder founding={founding} />);
      expect(note().textContent).toBe('first 50 customers');
      expect(screen.queryByText(/spots left/)).toBeNull();
      unmount();
    }
  });

  it('from 10 claims, says how many spots are left', () => {
    render(<PlanBuilder founding={spots(30)} />);
    expect(note().textContent).toBe('Only 20 of 50 founding spots left');
    expect(note().dataset.emphasised).toBeUndefined();
  });

  it('emphasises the last 5 spots', () => {
    render(<PlanBuilder founding={spots(46)} />);
    expect(note().textContent).toBe('Only 4 of 50 founding spots left');
    expect(note().dataset.emphasised).toBe('true');
  });

  it('is gone once every spot is taken, and Get Pro no longer carries the code', () => {
    const onSubscribe = vi.fn();
    render(<PlanBuilder onSubscribe={onSubscribe} founding={spots(50, 'closed')} />);
    expect(screen.queryByTestId('founding-offer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Get Pro/ }));
    expect(onSubscribe.mock.lastCall![0]).not.toHaveProperty('discount');
  });
});

describe('an older catalogue without Agency', () => {
  it('still renders Free, Starter and Pro, in three columns', () => {
    plans = original.filter((p) => p.tier !== 'agency');
    const { container } = render(<PlanBuilder />);
    expect(screen.queryByRole('heading', { name: 'Agency' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeTruthy();
    expect(screen.getAllByTestId('founding-offer')).toHaveLength(1);
    expect(container.querySelector('.lg\\:grid-cols-3')).toBeTruthy();
    expect(container.querySelector('.lg\\:grid-cols-4')).toBeNull();
  });
});
