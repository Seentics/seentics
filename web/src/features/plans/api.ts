import api from '@/lib/api';
import type { Plan } from './types';

export const planKeys = {
  all: ['plans'] as const,
  list: (category: 'individual' | 'agency') => ['plans', category] as const,
};

/** Public — gateway's GET /api/v1/plans needs no auth (marketing pricing page). */
export async function fetchPlans(category: 'individual' | 'agency'): Promise<Plan[]> {
  const res = await api.get('/plans', { params: { category } });
  return res.data.data as Plan[];
}
