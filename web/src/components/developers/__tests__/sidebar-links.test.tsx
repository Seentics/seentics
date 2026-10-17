import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({ entitlements: undefined as unknown }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/websites/site-1',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/features', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/features')>()),
  isEnterprise: true,
}));
vi.mock('@/features/suite/queries', () => ({ useEntitlements: () => ({ data: h.entitlements }) }));
vi.mock('@/components/dashboard/SidebarCustomizeDialog', () => ({ SidebarCustomizeDialog: () => null }));

import { Sidebar } from '@/components/dashboard/Sidebar';

const coreLimits = (limits: Record<string, number>) => ({ products: { core: { plan: 'X', tier: 'pro', limits } } });
const wrap = () => render(<QueryClientProvider client={new QueryClient()}><Sidebar websiteId="site-1" /></QueryClientProvider>);

beforeEach(() => {
  h.entitlements = undefined;
});

describe('dashboard sidebar', () => {
  it('Developers goes to the per-website developers page', () => {
    wrap();
    const links = screen.getAllByRole('link', { name: /Developers/ });
    expect(links.map(a => a.getAttribute('href'))).toContain('/websites/site-1/developers');
  });

  it('offers the Agency workspace with the Agency entitlement', () => {
    h.entitlements = coreLimits({ agency_features: 1 });
    wrap();
    expect(screen.getAllByRole('link', { name: /Agency workspace/ })[0].getAttribute('href')).toBe('/agency');
  });

  it('hides it without the entitlement, and while entitlements load', () => {
    h.entitlements = coreLimits({});
    const { unmount } = wrap();
    expect(screen.queryByRole('link', { name: /Agency workspace/ })).toBeNull();
    unmount();
    h.entitlements = undefined;
    wrap();
    expect(screen.queryByRole('link', { name: /Agency workspace/ })).toBeNull();
  });
});
