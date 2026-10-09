import api from '@/lib/api';
import type { MeterState } from './types';

/** This period's metered usage and bill; null when the account is not on Pay-As-You-Go. */
export async function fetchMeter(): Promise<MeterState | null> {
  const res = await api.get('/user/billing/meter');
  return (res.data?.data ?? null) as MeterState | null;
}

/** The whole monthly bill's ceiling in cents, or null to remove it. Applies at once. */
export async function saveSpendCap(spendCapCents: number | null): Promise<MeterState | null> {
  const res = await api.put('/user/billing/spend-cap', { spendCapCents });
  return (res.data?.data ?? null) as MeterState | null;
}
