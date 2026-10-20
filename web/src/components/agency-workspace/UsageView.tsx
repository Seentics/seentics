'use client';

import { useState } from 'react';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RESOURCE_IDS } from '@/features/agency/constants';
import { useClientUsage, useClients, useUsage, useWebsiteUsage } from '@/features/agency/queries';
import type { UsageRow } from '@/features/agency/types';
import { useLocale, useT } from '@/lib/i18n';
import type { AgencyMessages } from '@/lib/i18n/messages/agency-en';
import { EmptyState, ErrorNote, LoadingRow, Meter, Panel, WorkspacePage, compact, percentOf, shortDate, useErrorText } from './ui';

const ALL = '__all__';

/** The most-used capped resource, as a share of its cap; "No cap" while nothing is allocated. */
function capLabel(row: UsageRow, t: AgencyMessages['usage']): string {
  const capped = RESOURCE_IDS.filter(id => row.cap?.[id] != null && row.pct?.[id] != null);
  if (capped.length === 0) return t.noCap;
  const top = capped.reduce((a, b) => ((row.pct[b] ?? 0) > (row.pct[a] ?? 0) ? b : a));
  return t.capOf(Math.round(row.pct[top] ?? 0), t.resources[top]);
}

function UsageTable({ rows, label, loading, hasMore, onMore }: {
  rows: UsageRow[];
  label: string;
  loading: boolean;
  hasMore?: boolean;
  onMore?: () => void;
}) {
  const all = useT().agency;
  const t = all.usage;
  if (loading) return <LoadingRow />;
  if (rows.length === 0) return <EmptyState title={t.noneYet(label)} />;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{label}</TableHead>
            {RESOURCE_IDS.map(id => <TableHead key={id} className="text-right">{t.resources[id]}</TableHead>)}
            <TableHead className="text-right">{t.cap}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-foreground">{row.name}</TableCell>
              {RESOURCE_IDS.map(id => <TableCell key={id} className="text-right tabular-nums">{compact(row.used[id])}</TableCell>)}
              <TableCell className="text-right text-xs text-muted-foreground">{capLabel(row, t)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hasMore && (
        <div className="border-t border-border p-3 text-center">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onMore}>{all.common.loadMore}</Button>
        </div>
      )}
    </>
  );
}

export function UsageView() {
  const all = useT().agency;
  const t = all.usage;
  const { locale } = useLocale();
  const errorMessage = useErrorText();
  const usage = useUsage();
  const clientUsage = useClientUsage();
  const [client, setClient] = useState(ALL);
  const websiteUsage = useWebsiteUsage(client === ALL ? undefined : client);
  const clients = useClients({ status: 'active' });
  const u = usage.data;

  return (
    <WorkspacePage
      title={t.title}
      description={u ? t.descriptionPeriod(shortDate(u.period.start, locale, false), shortDate(u.period.end, locale)) : t.description}
    >
      {usage.isError ? (
        <Panel><ErrorNote>{errorMessage(usage.error)}</ErrorNote></Panel>
      ) : (
        <StatCards
          className="mb-5"
          isLoading={usage.isLoading}
          cards={u ? RESOURCE_IDS.map(id => ({
            label: t.resources[id],
            value: compact(u.used[id]),
            subtext: t.ofPool(percentOf(u.used[id], u.pool[id]), compact(u.pool[id])),
            tone: 'danger' as const,
            toneWhen: u.overage[id] > 0,
          })) : []}
        />
      )}

      {u && (
        <Panel title={t.pool} description={t.poolBody} className="mb-5" bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.resource}</TableHead>
                <TableHead className="w-[30%]">{t.used}</TableHead>
                <TableHead className="text-right">{t.pool}</TableHead>
                <TableHead className="text-right">{t.allocated}</TableHead>
                <TableHead className="text-right">{t.unallocated}</TableHead>
                <TableHead className="text-right">{t.overage}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RESOURCE_IDS.map(id => ({ id, label: t.resources[id] })).map(r => (
                <TableRow key={r.id} data-testid={`usage-${r.id}`}>
                  <TableCell className="font-medium text-foreground">{r.label}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Meter value={u.used[r.id]} max={u.pool[r.id]} label={t.usedLabel(r.label)} />
                      <span className="w-16 shrink-0 text-right text-xs tabular-nums">{compact(u.used[r.id])}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{compact(u.pool[r.id])}</TableCell>
                  <TableCell className="text-right tabular-nums">{compact(u.allocated[r.id])}</TableCell>
                  <TableCell className="text-right tabular-nums">{compact(u.unallocated[r.id])}</TableCell>
                  <TableCell className={u.overage[r.id] > 0 ? 'text-right tabular-nums text-destructive' : 'text-right tabular-nums'}>{compact(u.overage[r.id])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={t.byClient} bodyClassName="p-0" data-testid="usage-clients">
          {clientUsage.isError ? <div className="p-4"><ErrorNote>{errorMessage(clientUsage.error)}</ErrorNote></div> : (
            <UsageTable rows={clientUsage.items} label={all.common.clients} loading={clientUsage.isLoading} hasMore={clientUsage.hasNextPage} onMore={() => void clientUsage.fetchNextPage()} />
          )}
        </Panel>
        <Panel
          title={t.byWebsite}
          bodyClassName="p-0"
          data-testid="usage-websites"
          actions={
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger className="h-8 w-44 !bg-card text-xs" aria-label={t.filterWebsites}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="text-xs">{all.common.allClients}</SelectItem>
                {clients.items.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          }
        >
          {websiteUsage.isError ? <div className="p-4"><ErrorNote>{errorMessage(websiteUsage.error)}</ErrorNote></div> : (
            <UsageTable rows={websiteUsage.items} label={all.common.websites} loading={websiteUsage.isLoading} hasMore={websiteUsage.hasNextPage} onMore={() => void websiteUsage.fetchNextPage()} />
          )}
        </Panel>
      </div>
    </WorkspacePage>
  );
}
