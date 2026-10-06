import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
const api = vi.hoisted(() => ({ batch: vi.fn(), single: vi.fn() }));
vi.mock('@/lib/funnels-dashboard', () => ({ getDashboardFunnelsAnalytics: api.batch, getDashboardFunnelAnalytics: api.single }));
vi.mock('@/features/analytics/queries', () => ({ analyticsKeys: { all: ['analytics'] } }));
import { useFunnelsAnalytics } from '../queries';
it('requests one report batch for fifty funnels and reuses it when their order changes', async () => {
  api.batch.mockResolvedValue({ funnel0: { analytics: [{ conversion_rate: 50 }] } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const ids = Array.from({ length: 50 }, (_, i) => `funnel${i}`);
  const { result, rerender } = renderHook(({ ids }) => useFunnelsAnalytics(ids, 7, '11111111-1111-4111-8111-111111111111'), { wrapper, initialProps: { ids } });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(api.batch).toHaveBeenCalledTimes(1); expect(api.single).not.toHaveBeenCalled();
  act(() => rerender({ ids: [...ids].reverse() }));
  expect(api.batch).toHaveBeenCalledTimes(1);
});
