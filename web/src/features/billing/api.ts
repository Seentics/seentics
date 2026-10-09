import api from '@/lib/api';
import type { MeterState } from './types';

/** This period's extra usage and its cost; null when Extra usage is off. */
export async function fetchMeter(): Promise<MeterState | null> {
  const res = await api.get('/user/billing/meter');
  return (res.data?.data ?? null) as MeterState | null;
}

/** The most extra usage may cost in a month, in cents, or null to remove the cap. Applies at once. */
export async function saveSpendCap(spendCapCents: number | null): Promise<MeterState | null> {
  const res = await api.put('/user/billing/spend-cap', { spendCapCents });
  return (res.data?.data ?? null) as MeterState | null;
}

/** Turns Extra usage off: Pro stops at its included amounts again, at once. */
export async function turnOffExtraUsage(): Promise<void> {
  await api.delete('/user/billing/extra-usage');
}
