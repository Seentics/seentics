import api from '@/lib/api';
import type { Entitlements } from './types';

export const suiteKeys = {
  entitlements: ['suite', 'entitlements'] as const,
};

export async function fetchEntitlements(): Promise<Entitlements> {
  const res = await api.get('/entitlements');
  return res.data.data as Entitlements;
}
