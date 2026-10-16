import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plan } from '@/features/plans/types';

let plans: Plan[] = [
  { id: 'free', name: 'Free', tier: 'free', description: null, priceMonthly: 0, priceYearly: null, products: ['core', 'observe'], features: [],
    limits: { core: { monthly_events: 20_000, replays: 300, heatmaps: 3, funnels: 1, automations: 3, websites: -1, ai_analyses: 30, leads: 100, retention_days: 30 }, observe: { storage_gb: 3 } } },
  // Starter keeps the `analytics` id and tier (gateway db/sql/040).
  { id: 'analytics', name: 'Starter', tier: 'analytics', description: null, priceMonthly: 9, priceYearly: 90, products: ['core', 'observe'], features: [],
    limits: { core: { monthly_events: 200_000, replays: 1_500, heatmaps: -1, funnels: -1, automations: -1, websites: -1, ai_analyses: 100, leads: 2_500, retention_days: 365 }, observe: { storage_gb: 5 } } },
  { id: 'pro', name: 'Pro', tier: 'pro', description: null, priceMonthly: 24, priceYearly: 240, products: ['core', 'observe'], features: [],
    limits: { core: { monthly_events: -1, included_monthly_events: 1_000_000, replays: -1, included_replays: 5_000, heatmaps: -1, funnels: -1, automations: -1, websites: -1, ai_analyses: 300, leads: 25_000, retention_days: 1095 }, observe: { storage_gb: -1, included_storage_gb: 30 } } },
];

const original = plans;
vi.mock('@/features/plans/queries', () => ({ usePlans: () => ({ data: plans, isLoading: false, isError: false }) }));

const { PlanBuilder } = await import('@/components/subscription/PlanBuilder');

beforeEach(() => { vi.clearAllMocks(); plans = original; });

describe('PlanBuilder, monthly only (OFFER_YEARLY is off)', () => {
  it('shows Free, Starter and Pro at $0, $9 and $24, with no Monthly/Yearly toggle', () => {
    render(<PlanBuilder />);
    expect(screen.getByRole('heading', { name: 'Free' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Starter' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeTruthy();
    expect(screen.getByText('$9')).toBeTruthy();
    expect(screen.getByText('$24')).toBeTruthy();
    expect(screen.getAllByText('Billed monthly')).toHaveLength(2);
    // The catalogue has yearly prices, but they are not offered yet.
    expect(screen.queryByRole('button', { name: 'Monthly' })).toBeNull();
    expect(screen.queryByText(/yearly/i)).toBeNull();
  });

  it('hands the chosen plan to onSubscribe, monthly', () => {
    const onSubscribe = vi.fn();
    render(<PlanBuilder onSubscribe={onSubscribe} />);
    fireEvent.click(screen.getByRole('button', { name: /Get Pro/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'pro', price: 24, interval: 'month' });
    fireEvent.click(screen.getByRole('button', { name: /Get Starter/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'analytics', price: 9, interval: 'month' });
    fireEvent.click(screen.getByRole('button', { name: /Start free/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'free', price: 0, interval: 'month' });
  });

  it('marks the current plan', () => {
    render(<PlanBuilder currentPlan="pro" currentInterval="month" />);
    expect((screen.getByRole('button', { name: 'Current plan' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Get Starter/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the whole product on the Starter card', () => {
    render(<PlanBuilder />);
    expect(screen.getByText('Move to Pro any time')).toBeTruthy();
    expect(screen.getAllByText('heatmaps, funnels, automations').length).toBeGreaterThanOrEqual(2);
  });
});
