import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { demoMeter } from '@/lib/demo';
import { cancelInvoice, fetchInvoice, fetchInvoices, fetchManualSubscription, fetchMeter, saveSpendCap, submitPayment, turnOffExtraUsage } from './api';
import type { Invoice, MeterState, PaymentDetails } from './types';

export const billingKeys = {
  meter: ['billing', 'meter'] as const,
  invoices: ['billing', 'invoices'] as const,
  invoice: (id: string) => ['billing', 'invoices', id] as const,
  manual: ['billing', 'manual-subscription'] as const,
};

/** This period's extra usage, or null when it is off; the demo site shows a fixture. */
export function useMeter(options: { demo: boolean; enabled: boolean }) {
  return useQuery({
    queryKey: [...billingKeys.meter, options.demo],
    queryFn: async (): Promise<MeterState | null> => (options.demo ? demoMeter() : fetchMeter()),
    enabled: options.enabled,
    // Measured on request; a minute is fresh enough for a bill that is reported hourly.
    staleTime: 60_000,
  });
}

export function useSaveSpendCap() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: saveSpendCap,
    onSuccess: (state) => client.setQueryData([...billingKeys.meter, false], state),
  });
}

export function useTurnOffExtraUsage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: turnOffExtraUsage,
    onSuccess: () => client.setQueryData([...billingKeys.meter, false], null),
  });
}

/** The account's taka invoices. Off on the demo site, which has none. */
export function useInvoices(options: { enabled: boolean }) {
  return useQuery({ queryKey: billingKeys.invoices, queryFn: fetchInvoices, enabled: options.enabled, staleTime: 30_000 });
}

/**
 * One invoice. While it is being verified it is asked again every 15 seconds, so the page turns to
 * "Payment confirmed" by itself once we have checked it.
 */
export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: billingKeys.invoice(id ?? ''),
    queryFn: () => fetchInvoice(id!),
    enabled: !!id,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.status === 'submitted' ? 15_000 : false),
    refetchOnWindowFocus: true,
  });
}

export function useManualSubscription(options: { enabled: boolean }) {
  return useQuery({ queryKey: billingKeys.manual, queryFn: fetchManualSubscription, enabled: options.enabled, staleTime: 60_000 });
}

/** Writes an invoice the gateway returned into its own cache entry and refreshes the list. */
function useStoreInvoice() {
  const client = useQueryClient();
  return (invoice: Invoice) => {
    client.setQueryData(billingKeys.invoice(invoice.id), invoice);
    void client.invalidateQueries({ queryKey: billingKeys.invoices, exact: true });
  };
}

export function useSubmitPayment(id: string) {
  const store = useStoreInvoice();
  return useMutation({ mutationFn: (payment: PaymentDetails) => submitPayment(id, payment), onSuccess: store });
}

export function useCancelInvoice(id: string) {
  const store = useStoreInvoice();
  return useMutation({ mutationFn: () => cancelInvoice(id), onSuccess: store });
}
