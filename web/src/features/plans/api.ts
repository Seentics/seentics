import api from '@/lib/api';
import type { Plan } from './types';

export const planKeys = {
  all: ['plans'] as const,
  list: (product?: string) => ['plans', product ?? 'all'] as const,
};

/** Public — gateway's GET /api/v1/plans needs no auth (marketing pricing page).
 *  Without `product`, the whole catalogue: Free and Pro. */
export async function fetchPlans(product?: string): Promise<Plan[]> {
  const res = await api.get('/plans', { params: product ? { product } : {} });
  return res.data.data as Plan[];
}
