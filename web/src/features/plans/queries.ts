import { useQuery } from '@tanstack/react-query';
import { fetchFoundingSpots, fetchPlans, planKeys } from './api';

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

/**
 * The founding offer's spots left. The gateway reads Lemon Squeezy at most every 5 minutes, so
 * neither does this; on an error there is no data, and the cards fall back to FOUNDING_OFFER.seats.
 */
export function useFoundingSpots() {
  return useQuery({
    queryKey: planKeys.founding,
    queryFn: fetchFoundingSpots,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
