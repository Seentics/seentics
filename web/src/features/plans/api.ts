import api from '@/lib/api';
import type { Plan } from './types';

export const planKeys = {
  all: ['plans'] as const,
  list: (product: string) => ['plans', product] as const,
};

/** Public — gateway's GET /api/v1/plans needs no auth (marketing pricing page). */
export async function fetchPlans(product: string): Promise<Plan[]> {
  const res = await api.get('/plans', { params: { product } });
  return res.data.data as Plan[];
}
