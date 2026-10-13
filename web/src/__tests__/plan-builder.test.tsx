import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plan } from '@/features/plans/types';

let plans: Plan[] = [
  { id: 'free', name: 'Free', tier: 'free', description: null, priceMonthly: 0, priceYearly: null, products: ['core', 'observe'], features: [],
    limits: { core: { monthly_events: 20_000, replays: 300, heatmaps: 3, funnels: 1, automations: 3, websites: -1, ai_analyses: 30, leads: 100, retention_days: 30 }, observe: { storage_gb: 3 } } },
  { id: 'analytics', name: 'Analytics', tier: 'analytics', description: null, priceMonthly: 9, priceYearly: 84, products: ['core'], features: [],
    limits: { core: { monthly_events: 500_000, replays: 0, heatmaps: 0, funnels: -1, automations: 0, websites: -1, ai_analyses: 50, leads: 0, retention_days: 1095 } } },
  { id: 'pro', name: 'Pro', tier: 'pro', description: null, priceMonthly: 19, priceYearly: 168, products: ['core', 'observe'], features: [],
    limits: { core: { monthly_events: -1, included_monthly_events: 1_000_000, replays: -1, included_replays: 5_000, heatmaps: -1, funnels: -1, automations: -1, websites: -1, ai_analyses: 300, leads: 25_000, retention_days: 1095 }, observe: { storage_gb: -1, included_storage_gb: 30 } } },
];

const original = plans;
vi.mock('@/features/plans/queries', () => ({ usePlans: () => ({ data: plans, isLoading: false, isError: false }) }));

const { PlanBuilder } = await import('@/components/subscription/PlanBuilder');

beforeEach(() => { vi.clearAllMocks(); plans = original; });

describe('PlanBuilder against a catalogue with no yearly prices (an older gateway)', () => {
  it('shows no Monthly/Yearly toggle, and sells monthly', () => {
    plans = original.filter((p) => p.id !== 'analytics').map((p) => ({ ...p, priceYearly: null }));
    const onSubscribe = vi.fn();
    render(<PlanBuilder onSubscribe={onSubscribe} />);
    expect(screen.queryByRole('button', { name: 'Monthly' })).toBeNull();
    expect(screen.queryByText(/save up to/)).toBeNull();
    expect(screen.getByText('$19')).toBeTruthy();
    expect(screen.getByText('Billed monthly')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Get Pro/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'pro', price: 19, interval: 'month' });
  });
});

describe('PlanBuilder', () => {
  it('shows three plans, yearly first: $0, $7 and $14 a month, with the yearly totals', () => {
    render(<PlanBuilder />);
    expect(screen.getByRole('heading', { name: 'Free' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeTruthy();
    expect(screen.getByText('$7')).toBeTruthy();
    expect(screen.getByText('$14')).toBeTruthy();
    expect(screen.getByText('Billed $84 yearly · save 22%')).toBeTruthy();
    expect(screen.getByText('Billed $168 yearly · save 26%')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Yearly \(save up to 26%\)/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('switches to monthly: $9 and $19, billed monthly', () => {
    render(<PlanBuilder />);
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(screen.getByText('$9')).toBeTruthy();
    expect(screen.getByText('$19')).toBeTruthy();
    expect(screen.getAllByText('Billed monthly')).toHaveLength(2);
    expect(screen.queryByText(/Billed \$168 yearly/)).toBeNull();
  });

  it('hands the chosen plan and interval to onSubscribe', () => {
    const onSubscribe = vi.fn();
    render(<PlanBuilder onSubscribe={onSubscribe} />);
    fireEvent.click(screen.getByRole('button', { name: /Get Pro/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'pro', price: 14, interval: 'year' });
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    fireEvent.click(screen.getByRole('button', { name: /Get Analytics/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'analytics', price: 9, interval: 'month' });
    fireEvent.click(screen.getByRole('button', { name: /Start free/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'free', price: 0, interval: 'month' });
  });

  it('marks the current paid plan only on its own interval, so the other interval is a switch', () => {
    render(<PlanBuilder currentPlan="pro" currentInterval="month" />);
    // Yearly is showing and the customer is on monthly: Pro can be bought.
    expect((screen.getByRole('button', { name: /Get Pro/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect((screen.getByRole('button', { name: 'Current plan' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows no recordings or lead capture on the Analytics card', () => {
    render(<PlanBuilder />);
    expect(screen.getByText('Need replay or heatmaps? Go Pro')).toBeTruthy();
    expect(screen.getByText('Goals and unlimited funnels')).toBeTruthy();
    expect(screen.getByText('API access')).toBeTruthy();
  });
});
