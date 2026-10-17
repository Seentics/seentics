'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { errorMessage } from '@/features/agency/api';
import { RESOURCES } from '@/features/agency/constants';
import { useClientUsage, useClients, useUsage, useWebsiteUsage } from '@/features/agency/queries';
import type { UsageRow } from '@/features/agency/types';
import { EmptyState, ErrorNote, LoadingRow, Meter, Panel, WorkspacePage, compact, percentOf } from './ui';

const ALL = '__all__';

/** The most-used capped resource, as a share of its cap; "No cap" while nothing is allocated. */
function capLabel(row: UsageRow): string {
  const capped = RESOURCES.filter(r => row.cap?.[r.id] != null && row.pct?.[r.id] != null);
  if (capped.length === 0) return 'No cap';
  const top = capped.reduce((a, b) => ((row.pct[b.id] ?? 0) > (row.pct[a.id] ?? 0) ? b : a));
  return `${Math.round(row.pct[top.id] ?? 0)}% ${top.label.toLowerCase()}`;
}

function UsageTable({ rows, label, loading, hasMore, onMore }: {
  rows: UsageRow[];
  label: string;
  loading: boolean;
  hasMore?: boolean;
  onMore?: () => void;
}) {
  if (loading) return <LoadingRow />;
  if (rows.length === 0) return <EmptyState title={`No ${label.toLowerCase()} yet`} />;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{label}</TableHead>
            {RESOURCES.map(r => <TableHead key={r.id} className="text-right">{r.label}</TableHead>)}
            <TableHead className="text-right">Cap</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-foreground">{row.name}</TableCell>
              {RESOURCES.map(r => <TableCell key={r.id} className="text-right tabular-nums">{compact(row.used[r.id])}</TableCell>)}
              <TableCell className="text-right text-xs text-muted-foreground">{capLabel(row)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hasMore && (
        <div className="border-t border-border p-3 text-center">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onMore}>Load more</Button>
        </div>
      )}
    </>
  );
}

export function UsageView() {
  const usage = useUsage();
  const clientUsage = useClientUsage();
  const [client, setClient] = useState(ALL);
  const websiteUsage = useWebsiteUsage(client === ALL ? undefined : client);
  const clients = useClients({ status: 'active' });
  const u = usage.data;

  return (
    <WorkspacePage
      title="Usage"
      description={u ? `This month, ${format(new Date(u.period.start), 'd MMM')} to ${format(new Date(u.period.end), 'd MMM yyyy')}, against your Agency plan’s pool.` : 'This month, against your Agency plan’s pool.'}
    >
      {usage.isError ? (
        <Panel><ErrorNote>{errorMessage(usage.error)}</ErrorNote></Panel>
      ) : (
        <StatCards
          className="mb-5"
          isLoading={usage.isLoading}
          cards={u ? RESOURCES.map(r => ({
            label: r.label,
            value: compact(u.used[r.id]),
            subtext: `${percentOf(u.used[r.id], u.pool[r.id])} of ${compact(u.pool[r.id])}`,
            tone: 'danger' as const,
            toneWhen: u.overage[r.id] > 0,
          })) : []}
        />
      )}

      {u && (
        <Panel title="Pool" description="Caps per client and per website arrive in a later update; until then everything draws on the shared pool." className="mb-5" bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource</TableHead>
                <TableHead className="w-[30%]">Used</TableHead>
                <TableHead className="text-right">Pool</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Unallocated</TableHead>
                <TableHead className="text-right">Overage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RESOURCES.map(r => (
                <TableRow key={r.id} data-testid={`usage-${r.id}`}>
                  <TableCell className="font-medium text-foreground">{r.label}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Meter value={u.used[r.id]} max={u.pool[r.id]} label={`${r.label} used`} />
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
        <Panel title="By client" bodyClassName="p-0" data-testid="usage-clients">
          {clientUsage.isError ? <div className="p-4"><ErrorNote>{errorMessage(clientUsage.error)}</ErrorNote></div> : (
            <UsageTable rows={clientUsage.items} label="Clients" loading={clientUsage.isLoading} hasMore={clientUsage.hasNextPage} onMore={() => void clientUsage.fetchNextPage()} />
          )}
        </Panel>
        <Panel
          title="By website"
          bodyClassName="p-0"
          data-testid="usage-websites"
          actions={
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger className="h-8 w-44 !bg-card text-xs" aria-label="Filter websites by client"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="text-xs">All clients</SelectItem>
                {clients.items.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          }
        >
          {websiteUsage.isError ? <div className="p-4"><ErrorNote>{errorMessage(websiteUsage.error)}</ErrorNote></div> : (
            <UsageTable rows={websiteUsage.items} label="Websites" loading={websiteUsage.isLoading} hasMore={websiteUsage.hasNextPage} onMore={() => void websiteUsage.fetchNextPage()} />
          )}
        </Panel>
      </div>
    </WorkspacePage>
  );
}
