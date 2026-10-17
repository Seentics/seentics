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

describe('PlanBuilder', () => {
  it('shows Free, Starter, Pro and Agency, yearly by default with "2 months free"', () => {
    render(<PlanBuilder />);
    for (const name of ['Free', 'Starter', 'Pro', 'Agency']) expect(screen.getByRole('heading', { name })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yearly (2 months free)' }).getAttribute('aria-pressed')).toBe('true');
    // $90, $240 and $990 a year, shown a month at a time.
    expect(screen.getByText('$7.50')).toBeTruthy();
    expect(screen.getByText('$20')).toBeTruthy();
    expect(screen.getByText('$82.50')).toBeTruthy();
    expect(screen.getByText('Billed $990 yearly · 2 months free')).toBeTruthy();
    expect(screen.getByText('Billed $90 yearly · 2 months free')).toBeTruthy();
  });

  it('switches to monthly prices with the toggle', () => {
    render(<PlanBuilder />);
    monthly();
    expect(screen.getByRole('button', { name: 'Monthly' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('$9')).toBeTruthy();
    expect(screen.getByText('$24')).toBeTruthy();
    expect(screen.getByText('$99')).toBeTruthy();
    expect(screen.getAllByText('Billed monthly')).toHaveLength(3);
  });

  it('hands the chosen plan and interval to onSubscribe', () => {
    const onSubscribe = vi.fn();
    render(<PlanBuilder onSubscribe={onSubscribe} />);
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
    render(<PlanBuilder currentPlan="pro" currentInterval="year" />);
    expect((screen.getByRole('button', { name: 'Current plan' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Get Starter/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the whole product on the Starter card, and agency features only on Agency', () => {
    render(<PlanBuilder />);
    expect(screen.getByText('Move to Pro any time')).toBeTruthy();
    expect(screen.getAllByText('heatmaps, funnels, automations').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('client workspaces and websites')).toHaveLength(1);
    expect(screen.queryByText(/Agency: client/)).toBeNull();
    expect(screen.queryByText(/logs, traces/)).toBeNull();
  });
});

describe('the Agency card', () => {
  it('has its badge, pitch, client access on your own domain and the founding offer', () => {
    render(<PlanBuilder />);
    expect(screen.getByText('For agencies')).toBeTruthy();
    expect(screen.getByText('Most popular')).toBeTruthy();
    expect(screen.getByText('For agencies managing multiple client sites')).toBeTruthy();
    const access = screen.getByText('Client access and white-label reports on your own domain');
    expect(access.parentElement!.textContent).not.toContain('Coming soon');
    const offer = screen.getByTestId('founding-offer');
    expect(offer.textContent).toContain('Founding price: $49/month, locked in');
    expect(offer.textContent).toContain('first 10 agencies');
    expect(offer.textContent).toContain('Use code FOUNDING49 at checkout.');
  });

  it('sends the founding code only when the price is claimed, monthly at $49', () => {
    const onSubscribe = vi.fn();
    render(<PlanBuilder onSubscribe={onSubscribe} />);
    fireEvent.click(screen.getByRole('button', { name: /Get Agency/ }));
    expect(onSubscribe.mock.calls[0]![0]).not.toHaveProperty('discount');
    fireEvent.click(screen.getByRole('button', { name: 'Claim founding price' }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'agency', price: 49, interval: 'month', discount: 'FOUNDING49' });
  });

  it('is not offered to an account already on Agency', () => {
    render(<PlanBuilder currentPlan="agency" currentInterval="year" />);
    expect(screen.queryByTestId('founding-offer')).toBeNull();
  });
});

describe('an older catalogue without Agency', () => {
  it('still renders Free, Starter and Pro, in three columns', () => {
    plans = original.filter((p) => p.tier !== 'agency');
    const { container } = render(<PlanBuilder />);
    expect(screen.queryByRole('heading', { name: 'Agency' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeTruthy();
    expect(screen.queryByTestId('founding-offer')).toBeNull();
    expect(container.querySelector('.lg\\:grid-cols-3')).toBeTruthy();
    expect(container.querySelector('.lg\\:grid-cols-4')).toBeNull();
  });
});
