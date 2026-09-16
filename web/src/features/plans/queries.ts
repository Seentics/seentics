import { useQuery } from '@tanstack/react-query';
import { fetchPlans, planKeys } from './api';

export function usePlans(category: 'individual' | 'agency') {
  return useQuery({
    queryKey: planKeys.list(category),
    queryFn: () => fetchPlans(category),
    // The catalogue changes when pricing does, not while a visitor has the
    // page open — no point refetching on every tab focus.
    staleTime: 5 * 60_000,
  });
}
