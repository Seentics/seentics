import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Plan } from '@/features/plans/types';

const limits = { core: { monthly_events: 20_000, websites: -1, ai_analyses: 30, retention_days: 30 } };
const plans: Plan[] = [
  { id: 'free', name: 'Free', tier: 'free', description: null, priceMonthly: 0, priceYearly: null, priceMonthlyBdt: null, priceYearlyBdt: null, products: ['core'], features: [], limits },
  { id: 'starter', name: 'Starter', tier: 'starter', description: null, priceMonthly: 9, priceYearly: 90, priceMonthlyBdt: 499, priceYearlyBdt: 4990, products: ['core'], features: [], limits },
  { id: 'pro', name: 'Pro', tier: 'pro', description: null, priceMonthly: 24, priceYearly: 240, priceMonthlyBdt: 1499, priceYearlyBdt: 14990, products: ['core'], features: [], limits },
  { id: 'agency', name: 'Agency', tier: 'agency', description: null, priceMonthly: 99, priceYearly: 990, priceMonthlyBdt: 5999, priceYearlyBdt: 59990, products: ['core'], features: [], limits },
];

vi.mock('@/features/plans/queries', () => ({ usePlans: () => ({ data: plans, isLoading: false, isError: false }) }));
vi.mock('@/lib/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/i18n')>()),
  useLocale: () => ({
    locale: 'en',
    setLocale: () => {},
    region: { country: 'BD', region: 'bd', manualPayments: { accountName: null, methods: [{ id: 'bkash', name: 'bKash', number: '01700000000', kind: 'personal' }] } },
  }),
}));

const { PlanBuilder } = await import('@/components/subscription/PlanBuilder');

describe('PlanBuilder in Bangladesh', () => {
  it('shows taka prices, and sells them with an invoice', () => {
    const onSubscribe = vi.fn();
    render(<PlanBuilder onSubscribe={onSubscribe} />);
    expect(screen.getByText('৳499')).toBeTruthy();
    expect(screen.getByText('৳1,499')).toBeTruthy();
    expect(screen.getByText('৳5,999')).toBeTruthy();
    // The founding code is a card discount: not on the taka prices.
    expect(screen.queryByTestId('founding-offer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Get Pro/ }));
    expect(onSubscribe).toHaveBeenLastCalledWith({ plan: 'pro', price: 1499, interval: 'month', manual: true });
  });

  it('shows the year in taka, a month at a time', () => {
    render(<PlanBuilder />);
    fireEvent.click(screen.getByRole('button', { name: /^Yearly/ }));
    expect(screen.getByText('৳1,249')).toBeTruthy();
    expect(screen.getByText('৳14,990 billed yearly')).toBeTruthy();
  });

  it('can pay by card in dollars instead', () => {
    const onSubscribe = vi.fn();
    render(<PlanBuilder onSubscribe={onSubscribe} />);
    fireEvent.click(screen.getByRole('button', { name: 'International card ($)' }));
    expect(screen.getByText('$24')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Get Starter/ }));
    expect(onSubscribe.mock.lastCall![0]).toEqual({ plan: 'starter', price: 9, interval: 'month' });
  });
});
