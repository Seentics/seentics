'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, Lightbulb, Loader2, MousePointerClick, RefreshCw, ScrollText, Sparkles, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AskAiButton } from '@/components/ai/AskAiButton';
import { useAiStatus } from '@/features/ai/queries';
import {
  askAboutHeatmapPage, deviceLabel, formatRetry, reachRows, scrollHeadline, targetSummary,
  type DeviceAnalysis, type HeatmapInsights, type InsightDevice,
} from '@/features/heatmaps/insights';
import { useHeatmapInsights, useRefreshHeatmapInsights } from '@/features/heatmaps/insights-queries';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

export interface HeatmapInsightsPanelProps {
  websiteId: string;
  pagePath: string;
  days: number;
  device: InsightDevice;
  onClose?: () => void;
  className?: string;
}

/**
 * What one page's heatmap says, beside the heatmap: the scroll summary, the findings with a
 * suggested fix each, the most-clicked elements, and mobile against desktop.
 *
 * The numbers always show. The findings are worded by the AI model when one is configured, and
 * otherwise come straight from the rules that found them — labelled as such, without AI
 * branding. Callers leave it out on embeds and the demo.
 */
export function HeatmapInsightsPanel({ websiteId, pagePath, days, device, onClose, className }: HeatmapInsightsPanelProps) {
  const insights = useHeatmapInsights(websiteId, pagePath, days, device);
  const status = useAiStatus();
  const aiConfigured = insights.data?.ai_configured ?? status.data?.configured ?? false;
  const { isViewer } = usePermissions(websiteId);
  const refresh = useRefreshHeatmapInsights(websiteId, pagePath, days, device);
  const [forbidden, setForbidden] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // A refresh's cooldown comes from the server with the wording; count it down locally.
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const retryAfter = insights.data?.insights.retry_after_sec ?? null;
  useEffect(() => {
    setRetryUntil(retryAfter ? Date.now() + retryAfter * 1000 : null);
  }, [retryAfter, insights.dataUpdatedAt]);
  useEffect(() => {
    if (!retryUntil) return;
    const t = setTimeout(() => setRetryUntil(null), Math.max(0, retryUntil - Date.now()));
    return () => clearTimeout(t);
  }, [retryUntil]);

  const onRefresh = async () => {
    setRefreshError(null);
    try {
      const outcome = await refresh.mutateAsync();
      if (outcome.kind === 'forbidden') setForbidden(true);
    } catch {
      setRefreshError('Could not refresh right now. Try again later.');
    }
  };

  const ask = askAboutHeatmapPage(pagePath, days, device);
  const canRefresh = aiConfigured && !isViewer && !forbidden;
  const waitLabel = retryUntil ? formatRetry(Math.ceil((retryUntil - Date.now()) / 1000)) : null;

  return (
    <aside
      className={cn('flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card', className)}
      aria-label="Page insights"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        {aiConfigured
          ? <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          : <Lightbulb className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {aiConfigured ? 'AI insights' : 'Page insights'}
        </h2>
        <span className="truncate text-xs text-muted-foreground">{deviceLabel(device)}</span>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {canRefresh && (
            <IconButton
              label={waitLabel ? `Refresh available ${waitLabel}` : 'Reword these findings now'}
              onClick={() => void onRefresh()}
              disabled={refresh.isPending || insights.isPending || !!waitLabel || !insights.data?.analysis.sufficient}
            >
              {refresh.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </IconButton>
          )}
          {aiConfigured && <AskAiButton websiteId={websiteId} question={ask.question} context={ask.context} />}
          {onClose && (
            <IconButton label="Hide insights" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {insights.isPending ? (
          <div className="space-y-2.5" aria-busy="true">
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : insights.isError ? (
          <div className="space-y-2 text-[13px]">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Insights could not be loaded
            </p>
            <button type="button" onClick={() => void insights.refetch()} className="text-xs font-medium text-primary hover:underline">
              Try again
            </button>
          </div>
        ) : !insights.data.analysis.sufficient ? (
          <div className="text-[13px]">
            <p className="font-medium text-foreground">Not enough data yet</p>
            <p className="mt-0.5 text-muted-foreground">
              {insights.data.analysis.reason ?? 'Check back once more visitors have used this page.'}
            </p>
          </div>
        ) : (
          <PanelBody data={insights.data} aiConfigured={aiConfigured} />
        )}

        {(refreshError || forbidden) && (
          <p className="text-xs text-destructive">
            {forbidden ? 'Your role on this website cannot refresh insights.' : refreshError}
          </p>
        )}
      </div>
    </aside>
  );
}

function PanelBody({ data, aiConfigured }: { data: HeatmapInsights; aiConfigured: boolean }) {
  const { analysis, insights } = data;
  const scroll = analysis.overall.scroll;
  const clicks = analysis.overall.clicks;
  const headline = scrollHeadline(scroll);

  return (
    <>
      {scroll && (
        <section className="space-y-2">
          <SectionTitle icon={<ScrollText className="h-3.5 w-3.5" />}>Scroll depth</SectionTitle>
          {headline && <p className="text-[13px] leading-relaxed text-foreground">{headline}</p>}
          <ul className="space-y-1" aria-label="Share of page views reaching each depth">
            {reachRows(scroll).map((r) => (
              <li key={r.depth} className="flex items-center gap-2 text-xs">
                <span className="w-9 shrink-0 tabular-nums text-muted-foreground">{r.depth}%</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }} />
                </span>
                <span className="w-9 shrink-0 text-right tabular-nums text-foreground">{r.pct}%</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            {scroll.page_views.toLocaleString()} page views
            {clicks ? ` · ${clicks.clicks.toLocaleString()} clicks` : ''}
            {scroll.stayed_above_fold_pct !== null ? ` · ${scroll.stayed_above_fold_pct}% never scroll past the first screen` : ''}
          </p>
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle icon={<Lightbulb className="h-3.5 w-3.5" />}>
          Findings
          {insights.source === 'rules' && (
            <span
              className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/80"
              title={insights.reason ?? 'Worked out from the data by fixed rules.'}
            >
              · {aiConfigured ? 'rule-based' : 'from the data'}
            </span>
          )}
        </SectionTitle>
        {insights.findings.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nothing on this page stood out.</p>
        ) : (
          <ul className="space-y-2.5">
            {insights.findings.map((f) => (
              <li key={f.signal} className="space-y-1 text-[13px] leading-relaxed">
                <p className="text-foreground">
                  {f.finding}
                  {f.device !== 'all' && analysis.device === 'all' && (
                    <span className="ml-1.5 inline-flex rounded-md border border-border px-1.5 py-px align-middle text-[11px] leading-4 text-muted-foreground">
                      {deviceLabel(f.device)}
                    </span>
                  )}
                </p>
                <p className="rounded-md bg-primary/5 px-2 py-1 text-xs text-foreground/90">
                  <span className="font-medium text-primary">Fix: </span>{f.fix}
                </p>
              </li>
            ))}
          </ul>
        )}
        {insights.source === 'rules' && aiConfigured && insights.reason && (
          <p className="text-[11px] text-muted-foreground">{insights.reason}</p>
        )}
      </section>

      {clicks && clicks.top.length > 0 && (
        <section className="space-y-2">
          <SectionTitle icon={<MousePointerClick className="h-3.5 w-3.5" />}>Most clicked</SectionTitle>
          <ul className="space-y-1.5">
            {clicks.top.slice(0, 5).map((t) => (
              <li key={t.selector} className="text-xs">
                <div className="flex items-center gap-1.5">
                  <code className="min-w-0 truncate font-mono text-foreground" title={t.selector}>{t.selector}</code>
                  {t.interactive === false && (
                    <span className="shrink-0 rounded bg-amber-500/10 px-1 text-[10px] font-medium text-amber-700 dark:text-amber-400" title="Not a link or button: a possible dead click">
                      not clickable?
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">{targetSummary(t)}</p>
              </li>
            ))}
          </ul>
          {clicks.dead_clicks.known_share >= 50 && clicks.dead_clicks.clicks > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {clicks.dead_clicks.share}% of clicks land on elements that are not links or buttons (dead-click candidates).
            </p>
          )}
        </section>
      )}

      {analysis.devices.length > 1 && <DeviceTable devices={analysis.devices} />}

      <details className="group text-[11px] text-muted-foreground">
        <summary className="flex cursor-pointer list-none items-center gap-1 font-medium hover:text-foreground">
          <ChevronDown className="h-3 w-3 -rotate-90 transition-transform group-open:rotate-0" />
          What these numbers can&apos;t tell you
        </summary>
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          {analysis.limits.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </details>
    </>
  );
}

function DeviceTable({ devices }: { devices: DeviceAnalysis[] }) {
  return (
    <section className="space-y-2">
      <SectionTitle>By device</SectionTitle>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[11px] text-muted-foreground">
            <th className="pb-1 font-medium">Device</th>
            <th className="pb-1 text-right font-medium" title="Where half of page views stop, as % of the page">Median stop</th>
            <th className="pb-1 text-right font-medium" title="How much of the page shows without scrolling">Fold</th>
            <th className="pb-1 text-right font-medium">Clicks/view</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.device} className="border-t border-border/60">
              <td className="py-1 text-foreground">{deviceLabel(d.device)}</td>
              <td className="py-1 text-right tabular-nums">{d.scroll ? `${d.scroll.median_depth}%` : '—'}</td>
              <td className="py-1 text-right tabular-nums">{d.scroll?.fold_pct != null ? `${d.scroll.fold_pct}%` : '—'}</td>
              <td className="py-1 text-right tabular-nums">{d.clicks?.clicks_per_view != null ? d.clicks.clicks_per_view.toFixed(1) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      <span>{children}</span>
    </h3>
  );
}

function IconButton({ label, children, ...props }: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  );
}
