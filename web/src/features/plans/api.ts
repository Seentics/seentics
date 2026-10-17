import api from '@/lib/api';
import type { FoundingSpots, Plan } from './types';

export const planKeys = {
  all: ['plans'] as const,
  list: (product?: string) => ['plans', product ?? 'all'] as const,
  founding: ['plans', 'founding'] as const,
};

/** Public — gateway's GET /api/v1/plans needs no auth (marketing pricing page).
 *  Without `product`, the whole catalogue: Free, Analytics and Pro. */
export async function fetchPlans(product?: string): Promise<Plan[]> {
  const res = await api.get('/plans', { params: product ? { product } : {} });
  return res.data.data as Plan[];
}

/** Public — gateway's GET /api/v1/billing/founding: the founding offer's spots, counted by Lemon Squeezy. */
export async function fetchFoundingSpots(): Promise<FoundingSpots> {
  const res = await api.get('/billing/founding');
  return res.data.data as FoundingSpots;
}
