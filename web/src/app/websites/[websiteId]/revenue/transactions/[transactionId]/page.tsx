'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRevenueDashboard, formatMoney } from '@/lib/revenue-analytics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Receipt, Globe, Share2, Package } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function RevenueTransactionPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const transactionId = params?.transactionId as string;
  const { data, isLoading } = useRevenueDashboard(websiteId, 90);
  const tx = data?.recent_transactions?.find((t) => t.id === decodeURIComponent(transactionId));
  const cur = data?.summary?.currency ?? 'USD';

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-[800px] mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-[800px] mx-auto text-center">
        <p className="text-sm text-muted-foreground">This transaction is not in the last 90 days of data, or the id is invalid.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
          </Button>
          <Button variant="default" size="sm" asChild>
            <Link href={`/websites/${websiteId}/revenue`}>Revenue overview</Link>
          </Button>
        </div>
      </div>
    );
  }

  const items = tx.items?.length
    ? tx.items
    : tx.product_name
      ? [{ sku: '—', name: tx.product_name, qty: 1, price: tx.value }]
      : [];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[800px] mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
          onClick={() => router.push(`/websites/${websiteId}/revenue`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Revenue
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Transaction</h1>
            {tx.order_id && (
              <Badge variant="outline" className="font-mono text-xs">
                {tx.order_id}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{fmtTime(tx.occurred_at)}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatMoney(tx.value, tx.currency || cur)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              Attribution
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Source</span>
              <span className="font-medium text-right">{tx.source ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Medium</span>
              <span className="font-medium text-right">{tx.medium ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Campaign</span>
              <span className="font-medium text-right">{tx.campaign ?? '—'}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">User</span>
              <Badge variant="secondary">{tx.user_type === 'new' ? 'New' : tx.user_type === 'returning' ? 'Returning' : '—'}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Geography
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {tx.country ? <p className="font-medium">{tx.country}</p> : <p className="text-muted-foreground">No country on this event</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Line items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line items</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between items-start gap-4 py-3 first:pt-0 text-sm">
                  <div>
                    <p className="font-medium">{it.name}</p>
                    {it.sku && it.sku !== '—' && <p className="text-xs font-mono text-muted-foreground mt-0.5">{it.sku}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">Qty {it.qty}</p>
                  </div>
                  <span className="font-semibold tabular-nums shrink-0">{formatMoney(it.price, tx.currency || cur)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
