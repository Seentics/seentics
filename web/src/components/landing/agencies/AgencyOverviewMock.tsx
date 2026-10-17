import { AlertTriangle, Gauge, WifiOff } from 'lucide-react';
import { DEMO_AGENCY_NAME, demoAgencyClients, demoAgencyOverview } from '@/lib/demo/agency';
import type { AlertKind } from '@/features/agency/types';

/**
 * A still of the agency overview, from the agency demo's figures: totals across clients, the
 * client rows and the open alerts. A picture, not the app: hidden from assistive tech, and the
 * words around it carry the meaning.
 */
const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

const change = (now = 0, before = 0) => (before ? Math.round(((now - before) / before) * 100) : null);

const ALERT: Record<AlertKind, { label: string; icon: typeof Gauge; tone: string }> = {
  cap_80: { label: 'used 80% of its events', icon: Gauge, tone: 'text-amber-600 dark:text-amber-400' },
  cap_100: { label: 'reached its events cap', icon: AlertTriangle, tone: 'text-red-600 dark:text-red-400' },
  tracking_stopped: { label: 'stopped sending data', icon: WifiOff, tone: 'text-red-600 dark:text-red-400' },
};

export function AgencyOverviewMock() {
  const overview = demoAgencyOverview('30d');
  const names = new Map(demoAgencyClients().map((c) => [c.id, c.name]));
  const rows = overview.clients
    .filter((c) => c.status === 'active')
    .sort((a, b) => (b.totals.visitors ?? 0) - (a.totals.visitors ?? 0))
    .slice(0, 5);

  const tiles = [
    { label: 'Visitors', value: overview.totals.visitors, before: overview.previous_totals.visitors },
    { label: 'Pageviews', value: overview.totals.pageviews, before: overview.previous_totals.pageviews },
    { label: 'Events', value: overview.totals.events, before: overview.previous_totals.events },
    { label: 'Leads', value: overview.totals.leads, before: overview.previous_totals.leads },
  ];

  return (
    <div
      aria-hidden
      className="app-surface pointer-events-none select-none overflow-hidden rounded-xl border bg-background text-foreground"
      style={{ borderColor: 'var(--lx-line-strong)', boxShadow: 'var(--lx-shot-shadow)' }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[12px] font-bold text-primary-foreground">N</span>
          <span className="truncate text-[14px] font-semibold">{DEMO_AGENCY_NAME}</span>
          <span className="hidden text-[13px] text-muted-foreground sm:inline">/ Overview</span>
        </div>
        <span className="shrink-0 rounded-md border border-border px-2 py-1 text-[12px] text-muted-foreground">Last 30 days</span>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4">
        {tiles.map((t) => {
          const pct = change(t.value, t.before);
          return (
            <div key={t.label} className="bg-background px-4 py-3.5 sm:px-5">
              <p className="text-[12px] text-muted-foreground">{t.label}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-[20px] font-semibold tracking-tight sm:text-[22px]">{compact(t.value ?? 0)}</span>
                {pct !== null && (
                  <span className={`text-[12px] font-medium ${pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {pct >= 0 ? '+' : ''}{pct}%
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="px-4 py-4 sm:px-5">
          <p className="mb-2 text-[12px] font-medium text-muted-foreground">Clients</p>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] text-muted-foreground">
                <th className="py-1.5 font-medium">Client</th>
                <th className="hidden py-1.5 text-right font-medium sm:table-cell">Sites</th>
                <th className="py-1.5 text-right font-medium">Visitors</th>
                <th className="hidden py-1.5 text-right font-medium sm:table-cell">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = change(r.totals.visitors, r.previous_totals.visitors);
                return (
                  <tr key={r.id ?? 'none'} className="border-t border-border">
                    <td className="max-w-0 truncate py-2 pr-2 font-medium">{r.name}</td>
                    <td className="hidden py-2 text-right tabular-nums text-muted-foreground sm:table-cell">{r.website_count}</td>
                    <td className="py-2 text-right tabular-nums">{compact(r.totals.visitors ?? 0)}</td>
                    <td className={`hidden py-2 text-right tabular-nums sm:table-cell ${pct !== null && pct < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {pct === null ? '—' : `${pct >= 0 ? '+' : ''}${pct}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border px-4 py-4 sm:px-5 lg:border-l lg:border-t-0">
          <p className="mb-2 text-[12px] font-medium text-muted-foreground">Alerts</p>
          <ul className="space-y-2">
            {overview.alerts.map((a) => {
              const look = ALERT[a.kind];
              return (
                <li key={a.id} className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5">
                  <look.icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${look.tone}`} />
                  <span className="text-[13px] leading-snug">
                    <span className="font-medium">{(a.client_id && names.get(a.client_id)) || 'A website'}</span>{' '}
                    <span className="text-muted-foreground">{look.label}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
