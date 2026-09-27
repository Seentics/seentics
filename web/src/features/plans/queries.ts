import { useQuery } from '@tanstack/react-query';
import { fetchPlans, planKeys } from './api';

/** Plans granting `product`, or the whole catalogue when it's omitted. */
export function usePlans(product?: string) {
  return useQuery({
    queryKey: planKeys.list(product),
    queryFn: () => fetchPlans(product),
    // The catalogue changes when pricing does, not while a visitor has the
    // page open — no point refetching on every tab focus.
    staleTime: 5 * 60_000,
  });
}
