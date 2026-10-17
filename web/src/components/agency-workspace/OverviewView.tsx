'use client';

import Link from 'next/link';
import { AlertTriangle, BellOff, TrendingDown, TrendingUp, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dismissAlert, errorMessage } from '@/features/agency/api';
import { useAgencyMutation, useOverview, useSetup, useUsage } from '@/features/agency/queries';
import type { AgencyAlert, MetricTotals, OverviewClient } from '@/features/agency/types';
import { SetupGuide } from './SetupGuide';
import { Change, EmptyState, LoadingRow, Panel, Pill, WorkspacePage, compact, percentOf } from './ui';

/** Change in percent between two figures; `null` when there was nothing before. */
export function changePct(current: number | undefined, previous: number | undefined): number | null {
  if (!previous) return null;
  return (((current ?? 0) - previous) / previous) * 100;
}

const metric = (t: MetricTotals, k: keyof MetricTotals) => t[k] ?? 0;

function alertText(a: AgencyAlert, clientName: string | undefined): { title: string; body: string } {
  const who = clientName ?? (a.website_id ? 'A website' : 'Your account');
  switch (a.kind) {
    case 'tracking_stopped': return { title: 'Tracking stopped', body: `${who}: no events in the last 24 hours, after events in the last 7 days.` };
    case 'cap_80': return { title: '80% of cap', body: `${who} has used 80% of its ${a.resource.replace('_', ' ')} cap this month.` };
    case 'cap_100': return { title: 'Cap reached', body: `${who} reached its ${a.resource.replace('_', ' ')} cap; collection is paused until next month.` };
  }
}

export function OverviewView() {
  const overview = useOverview('30d');
  const setup = useSetup();
  const usage = useUsage();
  const dismiss = useAgencyMutation(dismissAlert);
  const data = overview.data;

  if (overview.isLoading) {
    return (
      <WorkspacePage title="Overview" description="Every client at a glance.">
        <StatCards isLoading cards={[]} />
        <LoadingRow />
      </WorkspacePage>
    );
  }

  if (overview.isError || !data) {
    return (
      <WorkspacePage title="Overview" description="Every client at a glance.">
        <Panel><EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Could not load the overview" description={errorMessage(overview.error)} /></Panel>
      </WorkspacePage>
    );
  }

  const clients = data.clients.filter((c): c is OverviewClient & { id: string } => c.id !== null);
  const unassigned = data.clients.find(c => c.id === null);

  if (clients.length === 0) {
    return (
      <WorkspacePage title="Welcome to your agency workspace" description="Add your brand, your clients and their websites, then share dashboards with them.">
        <SetupGuide setup={setup.data} />
      </WorkspacePage>
    );
  }

  const names = new Map(clients.map(c => [c.id, c.name]));
  const websites = data.clients.reduce((n, c) => n + c.website_count, 0);
  const active = clients.filter(c => c.status === 'active').length;
  const pool = usage.data?.pool;
  const used = usage.data?.used;
  const setupLeft = setup.data && setup.data.completed < setup.data.total;
  const rows = [...clients].sort((a, b) => metric(b.totals, 'visitors') - metric(a.totals, 'visitors'));

  return (
    <WorkspacePage title="Overview" description="Every client at a glance, over the last 30 days against the 30 before.">
      <StatCards
        className="mb-5"
        cards={[
          { label: 'Clients', value: clients.length, subtext: `${active} active` },
          { label: 'Websites', value: websites, subtext: unassigned?.website_count ? `${unassigned.website_count} not assigned` : 'All assigned' },
          {
            label: 'Visitors',
            value: compact(metric(data.totals, 'visitors')),
            subtext: 'Last 30 days',
            delta: <Change pct={changePct(data.totals.visitors, data.previous_totals.visitors)} />,
          },
          {
            label: 'Events this month',
            value: used ? compact(used.events) : compact(metric(data.totals, 'events')),
            subtext: pool && used ? `${percentOf(used.events, pool.events)} of ${compact(pool.events)} pool` : 'Of your plan’s pool',
          },
        ]}
      />

      {setupLeft && (
        <div className="mb-5 flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-foreground">Setup: {setup.data!.completed} of {setup.data!.total} steps done.</span>
          <a href="#agency-setup" className="text-xs font-medium text-primary hover:underline">Finish setting up</a>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Clients" description="The last 30 days, and the change against the 30 days before." bodyClassName="p-0"
          actions={<Button asChild variant="outline" size="sm" className="h-8 text-xs"><Link href="/agency/clients">All clients</Link></Button>}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Websites</TableHead>
                <TableHead className="text-right">Visitors</TableHead>
                <TableHead className="text-right">Trend</TableHead>
                <TableHead className="hidden text-right md:table-cell">Events</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Leads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/agency/clients/${c.id}`} className="font-medium text-foreground hover:underline">{c.name}</Link>
                    {c.status && c.status !== 'active' && <span className="ml-2"><Pill>{c.status === 'archived' ? 'Archived' : 'Suspended'}</Pill></span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.website_count}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{compact(metric(c.totals, 'visitors'))}</TableCell>
                  <TableCell className="text-right"><Change pct={changePct(c.totals.visitors, c.previous_totals.visitors)} /></TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{compact(metric(c.totals, 'events'))}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{compact(metric(c.totals, 'leads'))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <div className="space-y-5">
          <Panel title="Alerts" bodyClassName="p-0" data-testid="alerts">
            {data.alerts.length === 0 ? (
              <EmptyState icon={<BellOff className="h-5 w-5" />} title="No alerts" description="Sites that stop sending events show up here." />
            ) : (
              <ul className="divide-y divide-border">
                {data.alerts.map(a => {
                  const text = alertText(a, a.client_id ? names.get(a.client_id) : undefined);
                  return (
                    <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <AlertTriangle className={a.kind === 'cap_100' ? 'mt-0.5 h-4 w-4 shrink-0 text-destructive' : 'mt-0.5 h-4 w-4 shrink-0 text-amber-500'} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">{text.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{text.body}</p>
                        {a.website_id && <Link href={`/websites/${a.website_id}`} className="mt-1 inline-block text-[11px] font-medium text-primary hover:underline">Open site</Link>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
                        aria-label={`Dismiss alert: ${text.title}`}
                        disabled={dismiss.isPending}
                        onClick={() => dismiss.mutate(a.id, { onError: e => toast.error(errorMessage(e)) })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Top movers" description="Websites whose visitors changed most." bodyClassName="p-0" data-testid="movers">
            {data.top_movers.length === 0 ? (
              <EmptyState icon={<Users className="h-5 w-5" />} title="Nothing moving yet" />
            ) : (
              <ul className="divide-y divide-border">
                {data.top_movers.map(m => (
                  <li key={m.website_id} className="flex items-center gap-3 px-4 py-2.5">
                    {(m.change_pct ?? 0) >= 0
                      ? <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
                      : <TrendingDown className="h-4 w-4 shrink-0 text-rose-500" />}
                    <div className="min-w-0 flex-1">
                      <Link href={`/websites/${m.website_id}`} className="block truncate text-sm font-medium text-foreground hover:underline">{m.website_name}</Link>
                      {m.client_id && names.get(m.client_id) && <p className="truncate text-[11px] text-muted-foreground">{names.get(m.client_id)}</p>}
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">{compact(m.previous)} → {compact(m.current)}</span>
                    <Change pct={m.change_pct} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {setupLeft && <div id="agency-setup" className="mt-5"><SetupGuide setup={setup.data} /></div>}
    </WorkspacePage>
  );
}
