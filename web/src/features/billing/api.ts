import api from '@/lib/api';
import type { Invoice, ManualSubscription, MeterState, PaymentDetails } from './types';

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

/** An invoice for `plan`, payable in taka; replaces any unpaid one for a new plan. */
export async function createInvoice(plan: string, interval: 'month' | 'year'): Promise<Invoice> {
  const res = await api.post('/user/billing/invoices', { plan, interval });
  return res.data.data as Invoice;
}

/** The account's taka invoices, newest first. */
export async function fetchInvoices(): Promise<Invoice[]> {
  const res = await api.get('/user/billing/invoices');
  return (res.data?.data ?? []) as Invoice[];
}

export async function fetchInvoice(id: string): Promise<Invoice> {
  const res = await api.get(`/user/billing/invoices/${encodeURIComponent(id)}`);
  return res.data.data as Invoice;
}

/** The customer has paid: the transaction for us to verify. The invoice becomes `submitted`. */
export async function submitPayment(id: string, payment: PaymentDetails): Promise<Invoice> {
  const res = await api.post(`/user/billing/invoices/${encodeURIComponent(id)}/payment`, payment);
  return res.data.data as Invoice;
}

export async function cancelInvoice(id: string): Promise<Invoice> {
  const res = await api.post(`/user/billing/invoices/${encodeURIComponent(id)}/cancel`);
  return res.data.data as Invoice;
}

/** The plan paid for in taka, or null when the account has none running. */
export async function fetchManualSubscription(): Promise<ManualSubscription | null> {
  const res = await api.get('/user/billing/manual-subscription');
  return (res.data?.data ?? null) as ManualSubscription | null;
}
