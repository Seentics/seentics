'use client';

import Link from 'next/link';
import { AlertTriangle, BellOff, TrendingDown, TrendingUp, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dismissAlert } from '@/features/agency/api';
import { useAgencyMutation, useOverview, useSetup, useUsage } from '@/features/agency/queries';
import type { AgencyAlert, MetricTotals, OverviewClient } from '@/features/agency/types';
import { agencySiteHref } from '@/lib/demo/agency-mode';
import { useT } from '@/lib/i18n';
import type { AgencyMessages } from '@/lib/i18n/messages/agency-en';
import { SetupGuide } from './SetupGuide';
import { Change, EmptyState, LoadingRow, Panel, Pill, WorkspacePage, compact, percentOf, useErrorText } from './ui';

/** Change in percent between two figures; `null` when there was nothing before. */
export function changePct(current: number | undefined, previous: number | undefined): number | null {
  if (!previous) return null;
  return (((current ?? 0) - previous) / previous) * 100;
}

const metric = (t: MetricTotals, k: keyof MetricTotals) => t[k] ?? 0;

function alertText(a: AgencyAlert, clientName: string | undefined, t: AgencyMessages['overview']): { title: string; body: string } {
  const who = clientName ?? (a.website_id ? t.aWebsite : t.yourAccount);
  const resource = (t.resources as Record<string, string>)[a.resource] ?? a.resource.replace('_', ' ');
  switch (a.kind) {
    case 'tracking_stopped': return { title: t.alertTrackingStopped, body: t.alertTrackingStoppedBody(who) };
    case 'cap_80': return { title: t.alertCap80, body: t.alertCap80Body(who, resource) };
    case 'cap_100': return { title: t.alertCap100, body: t.alertCap100Body(who, resource) };
  }
}

export function OverviewView() {
  const all = useT().agency;
  const t = all.overview;
  const errorMessage = useErrorText();
  const overview = useOverview('30d');
  const setup = useSetup();
  const usage = useUsage();
  const dismiss = useAgencyMutation(dismissAlert);
  const data = overview.data;

  if (overview.isLoading) {
    return (
      <WorkspacePage title={t.title} description={t.description}>
        <StatCards isLoading cards={[]} />
        <LoadingRow />
      </WorkspacePage>
    );
  }

  if (overview.isError || !data) {
    return (
      <WorkspacePage title={t.title} description={t.description}>
        <Panel><EmptyState icon={<AlertTriangle className="h-5 w-5" />} title={t.loadFailed} description={errorMessage(overview.error)} /></Panel>
      </WorkspacePage>
    );
  }

  const clients = data.clients.filter((c): c is OverviewClient & { id: string } => c.id !== null);
  const unassigned = data.clients.find(c => c.id === null);

  if (clients.length === 0) {
    return (
      <WorkspacePage title={t.welcomeTitle} description={t.welcomeBody}>
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
    <WorkspacePage title={t.title} description={t.descriptionFull}>
      <StatCards
        className="mb-5"
        cards={[
          { label: all.common.clients, value: clients.length, subtext: t.activeCount(active) },
          { label: all.common.websites, value: websites, subtext: unassigned?.website_count ? t.notAssignedCount(unassigned.website_count) : t.allAssigned },
          {
            label: t.visitors,
            value: compact(metric(data.totals, 'visitors')),
            subtext: t.last30Days,
            delta: <Change pct={changePct(data.totals.visitors, data.previous_totals.visitors)} />,
          },
          {
            label: t.eventsThisMonth,
            value: used ? compact(used.events) : compact(metric(data.totals, 'events')),
            subtext: pool && used ? t.ofPool(percentOf(used.events, pool.events), compact(pool.events)) : t.ofPlanPool,
          },
        ]}
      />

      {setupLeft && (
        <div className="mb-5 flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-foreground">{t.setupLeft(setup.data!.completed, setup.data!.total)}</span>
          <a href="#agency-setup" className="text-xs font-medium text-primary hover:underline">{t.finishSetup}</a>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={all.common.clients} description={t.clientsDescription} bodyClassName="p-0"
          actions={<Button asChild variant="outline" size="sm" className="h-8 text-xs"><Link href="/agency/clients">{t.allClients}</Link></Button>}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{all.common.client}</TableHead>
                <TableHead className="text-right">{all.common.websites}</TableHead>
                <TableHead className="text-right">{t.visitors}</TableHead>
                <TableHead className="text-right">{t.trend}</TableHead>
                <TableHead className="hidden text-right md:table-cell">{t.events}</TableHead>
                <TableHead className="hidden text-right lg:table-cell">{t.leads}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/agency/clients/${c.id}`} className="font-medium text-foreground hover:underline">{c.name}</Link>
                    {c.status && c.status !== 'active' && <span className="ml-2"><Pill>{all.common.status[c.status === 'archived' ? 'archived' : 'suspended']}</Pill></span>}
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
          <Panel title={t.alerts} bodyClassName="p-0" data-testid="alerts">
            {data.alerts.length === 0 ? (
              <EmptyState icon={<BellOff className="h-5 w-5" />} title={t.noAlerts} description={t.noAlertsBody} />
            ) : (
              <ul className="divide-y divide-border">
                {data.alerts.map(a => {
                  const text = alertText(a, a.client_id ? names.get(a.client_id) : undefined, t);
                  return (
                    <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <AlertTriangle className={a.kind === 'cap_100' ? 'mt-0.5 h-4 w-4 shrink-0 text-destructive' : 'mt-0.5 h-4 w-4 shrink-0 text-amber-500'} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">{text.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{text.body}</p>
                        {a.website_id && <Link href={agencySiteHref(a.website_id)} className="mt-1 inline-block text-[11px] font-medium text-primary hover:underline">{all.common.openSite}</Link>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
                        aria-label={t.dismissAlert(text.title)}
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

          <Panel title={t.topMovers} description={t.topMoversBody} bodyClassName="p-0" data-testid="movers">
            {data.top_movers.length === 0 ? (
              <EmptyState icon={<Users className="h-5 w-5" />} title={t.nothingMoving} />
            ) : (
              <ul className="divide-y divide-border">
                {data.top_movers.map(m => (
                  <li key={m.website_id} className="flex items-center gap-3 px-4 py-2.5">
                    {(m.change_pct ?? 0) >= 0
                      ? <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
                      : <TrendingDown className="h-4 w-4 shrink-0 text-rose-500" />}
                    <div className="min-w-0 flex-1">
                      <Link href={agencySiteHref(m.website_id)} className="block truncate text-sm font-medium text-foreground hover:underline">{m.website_name}</Link>
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
