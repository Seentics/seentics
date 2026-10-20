'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Check, CheckCircle, Copy, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BillingShell } from '@/components/subscription/BillingShell';
import { InvoiceStatusBadge } from '@/components/subscription/TakaBilling';
import { useCancelInvoice, useInvoice, useSubmitPayment } from '@/features/billing/queries';
import { isBdMobile, isTransactionId, normalisePayerNumber } from '@/features/billing/payment';
import type { Invoice } from '@/features/billing/types';
import { formatTaka } from '@/features/plans/pricing-spec';
import { config } from '@/lib/config';
import { formatDate, useLocale, useT, type ManualPaymentMethod } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * One taka invoice (`/billing/invoice?id=…`, the link in its email): what it is for and how much,
 * where to send the money with bKash, Nagad or Rocket, and the form for the transaction id. Then
 * it waits while we verify the payment, and shows the plan on once we have.
 *
 * The id is a query parameter, not a path segment, so the static export needs no shell rule.
 */
export default function InvoicePage() {
  // Undefined until the URL has been read (the first effect), so the page does not flash "not found".
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => setId(new URLSearchParams(window.location.search).get('id')), []);
  return (
    <BillingShell>
      <InvoiceView id={id} />
    </BillingShell>
  );
}

function InvoiceView({ id }: { id: string | null | undefined }) {
  const t = useT();
  const { locale } = useLocale();
  const { data: invoice, isLoading } = useInvoice(id ?? null);

  if (id === undefined || isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!invoice) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">{t.invoice.notFound}</p>
        <Button variant="outline" size="sm" className="mt-4" asChild><Link href="/billing">{t.invoice.goToBilling}</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/billing" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> {t.invoice.goToBilling}
      </Link>

      <Card className="border border-border">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">{t.invoice.title(invoice.number)}</h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <Fact label={t.invoice.plan} value={`${invoice.planName} · ${t.bd.interval[invoice.interval]} · ${t.bd.kind[invoice.kind]}`} />
            <Fact label={t.invoice.amount} value={formatTaka(invoice.amountBdt)} strong />
            {invoice.status !== 'paid' && invoice.status !== 'void' && <Fact label={t.invoice.due} value={formatDate(invoice.dueAt, locale)} />}
            {invoice.periodStart && invoice.periodEnd && (
              <Fact label={t.invoice.period} value={`${formatDate(invoice.periodStart, locale)} – ${formatDate(invoice.periodEnd, locale)}`} />
            )}
          </dl>
        </CardContent>
      </Card>

      {invoice.status === 'paid' && (
        <Outcome icon={<CheckCircle className="h-6 w-6 text-emerald-500" />} title={t.invoice.paidTitle}>
          <p>{t.invoice.paidBody(invoice.planName, invoice.periodEnd ? formatDate(invoice.periodEnd, locale) : null)}</p>
          <Button size="sm" className="mt-4" asChild><Link href="/websites">{t.common.backToDashboard}</Link></Button>
        </Outcome>
      )}

      {invoice.status === 'submitted' && (
        <Outcome icon={<Loader2 className="h-6 w-6 animate-spin text-sky-500" />} title={t.invoice.verifyingTitle}>
          <p>{t.invoice.verifyingBody}</p>
          <p className="mt-3 font-mono text-[13px] text-foreground">
            {[invoice.paymentMethod, invoice.payerNumber, invoice.transactionId].filter(Boolean).join(' · ')}
          </p>
          {invoice.submittedAt && <p className="mt-1 text-xs">{t.invoice.submittedAt(formatDate(invoice.submittedAt, locale))}</p>}
        </Outcome>
      )}

      {invoice.status === 'void' && (
        <Outcome icon={<XCircle className="h-6 w-6 text-muted-foreground" />} title={t.invoice.voidTitle}>
          <p>{t.invoice.voidBody}</p>
          <Button variant="outline" size="sm" className="mt-4" asChild><Link href="/pricing">{t.invoice.seePlans}</Link></Button>
        </Outcome>
      )}

      {(invoice.status === 'open' || invoice.status === 'rejected') && <PayInvoice invoice={invoice} />}

      <p className="text-center text-xs text-muted-foreground">
        {t.invoice.support} <a href={`mailto:${config.supportEmail}`} className="underline underline-offset-2">{config.supportEmail}</a>
      </p>
    </div>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn('mt-1', strong ? 'text-2xl font-bold tabular-nums' : 'font-medium')}>{value}</dd>
    </div>
  );
}

function Outcome({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="border border-border">
      <CardContent className="flex gap-4 p-6">
        <div className="shrink-0">{icon}</div>
        <div className="text-sm text-muted-foreground">
          <h2 className="mb-1 text-base font-semibold text-foreground">{title}</h2>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function CopyValue({ value, mono = true }: { value: string; mono?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the value is on screen to type
    }
  };
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('text-base font-semibold', mono && 'font-mono tracking-wide')}>{value}</span>
      <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? t.common.copied : t.common.copy}
      </button>
    </span>
  );
}

/**
 * The numbers to pay to: the gateway's for this visitor's region, or the invoice's own when it
 * carries them (`payTo`), so a customer paying from abroad still sees where to send the money.
 */
function usePayTo(invoice: Invoice) {
  const { region } = useLocale();
  return invoice.payTo ?? region?.manualPayments ?? null;
}

function PayInvoice({ invoice }: { invoice: Invoice }) {
  const t = useT();
  const payTo = usePayTo(invoice);
  const methods = payTo?.methods ?? [];
  const [methodId, setMethodId] = useState<ManualPaymentMethod['id'] | null>(null);
  const method = methods.find((m) => m.id === methodId) ?? methods[0] ?? null;
  const [payer, setPayer] = useState('');
  const [trx, setTrx] = useState('');
  const [touched, setTouched] = useState(false);
  const submit = useSubmitPayment(invoice.id);
  const cancel = useCancelInvoice(invoice.id);
  const [confirm, confirmDialog] = useConfirm();

  const payerOk = isBdMobile(payer);
  const trxOk = isTransactionId(trx);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!method || !payerOk || !trxOk) return;
    try {
      await submit.mutateAsync({ method: method.id, payerNumber: normalisePayerNumber(payer), transactionId: trx.trim().toUpperCase() });
    } catch (err: any) {
      toast.error(err?.response?.status === 409 ? t.invoice.duplicate : err?.response?.data?.error || t.invoice.submitFailed);
    }
  };

  const cancelInvoice = async () => {
    if (!(await confirm({ title: t.invoice.cancel, description: t.invoice.cancelConfirm, confirmLabel: t.invoice.cancel, destructive: true }))) return;
    try {
      await cancel.mutateAsync();
      toast.success(t.invoice.cancelled);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t.common.tryAgain);
    }
  };

  return (
    <>
      {confirmDialog}
      {invoice.status === 'rejected' && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{t.invoice.rejectedTitle}</p>
            {invoice.rejectReason && <p className="mt-1">{t.invoice.reason}: {invoice.rejectReason}</p>}
            <p className="mt-1">{t.invoice.rejectedBody}</p>
          </div>
        </div>
      )}

      <Card className="border border-border">
        <CardContent className="space-y-5 p-6">
          <h2 className="text-base font-semibold">{t.invoice.howToPay}</h2>

          {methods.length > 1 && (
            <div role="group" aria-label={t.invoice.chooseMethod} className="inline-flex rounded-full border border-border bg-card p-1 text-sm font-medium">
              {methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={method?.id === m.id}
                  onClick={() => setMethodId(m.id)}
                  className={cn('rounded-full px-4 py-1.5 transition-colors', method?.id === m.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {method ? (
            <>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                {t.invoice.steps[method.kind](method.name).map((step) => <li key={step}>{step}</li>)}
              </ol>
              <dl className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">{t.invoice.numberLabel(method.kind)} · {method.name}</dt>
                  <dd className="mt-1"><CopyValue value={method.number} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t.invoice.amount}</dt>
                  <dd className="mt-1"><CopyValue value={String(invoice.amountBdt)} /></dd>
                </div>
                {method.kind !== 'agent' && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.invoice.reference}</dt>
                    <dd className="mt-1"><CopyValue value={invoice.number} /></dd>
                  </div>
                )}
                {payTo?.accountName && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.invoice.accountName}</dt>
                    <dd className="mt-1 text-base font-semibold">{payTo.accountName}</dd>
                  </div>
                )}
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t.bd.unavailable}</p>
          )}
        </CardContent>
      </Card>

      {method && (
        <Card className="border border-border">
          <CardContent className="p-6">
            <h2 className="text-base font-semibold">{t.invoice.submitTitle}</h2>
            <form onSubmit={send} className="mt-4 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="payer">{t.invoice.payerNumber}</Label>
                <Input
                  id="payer"
                  inputMode="tel"
                  autoComplete="tel"
                  value={payer}
                  onChange={(e) => setPayer(e.target.value)}
                  placeholder={t.invoice.payerPlaceholder}
                  aria-invalid={touched && !payerOk}
                />
                {touched && !payerOk && <p className="text-xs text-destructive">{t.invoice.payerInvalid}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trx">{t.invoice.transactionId}</Label>
                <Input
                  id="trx"
                  autoCapitalize="characters"
                  autoComplete="off"
                  value={trx}
                  onChange={(e) => setTrx(e.target.value)}
                  placeholder={t.invoice.transactionPlaceholder}
                  className="font-mono uppercase"
                  aria-invalid={touched && !trxOk}
                />
                {touched && !trxOk && <p className="text-xs text-destructive">{t.invoice.transactionInvalid}</p>}
              </div>
              <p className="text-xs text-muted-foreground">{t.invoice.method}: <span className="font-medium text-foreground">{method.name}</span></p>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <Button type="submit" disabled={submit.isPending} className="gap-1.5">
                  {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t.invoice.submit}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={cancelInvoice} disabled={cancel.isPending}>
                  {t.invoice.cancel}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
}
