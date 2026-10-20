'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAlerts } from '@/features/ai/alerts/queries';
import { useAiStatus } from '@/features/ai/queries';
import {
  SEVERITY_DOT, alertHref, alertLinkLabel, askWhyHref, bannerAlerts, relativeTime,
} from '@/features/ai/alerts/format';
import type { AlertView } from '@/features/ai/alerts/types';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface AlertsBannerProps {
  websiteId: string;
  className?: string;
}

/**
 * Anomalies the hourly check found on this site — a traffic drop or spike, tracking gone quiet,
 * an error surge, conversions falling — above the daily insight.
 *
 * Compact on purpose: one line per alert, the worst first, and nothing at all when the site
 * is behaving normally. Callers leave it out on embeds and the demo.
 */
export function AlertsBanner({ websiteId, className }: AlertsBannerProps) {
  const alerts = useAlerts(websiteId);
  const t = useT().ai.alerts;
  // Alerts come from the hourly check whether or not a model is configured; asking why needs one.
  const canAsk = useAiStatus(true, websiteId).data?.configured === true;
  // "3 min ago" depends on the clock: computed after mount so the server markup matches.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (now == null || !websiteId || alerts.isPending || alerts.isError || !alerts.data) return null;
  const { shown, hidden } = bannerAlerts(alerts.data.alerts, now);
  if (shown.length === 0) return null;
  const open = shown.some((a) => a.status === 'open');

  return (
    <Card
      className={cn('surface overflow-hidden', open && 'border-amber-500/40', className)}
      role="region"
      aria-label={t.regionLabel}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        {open
          ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {open ? t.unusual : t.backToNormal}
        </h2>
        {hidden > 0 && <span className="text-xs text-muted-foreground">{t.more(hidden)}</span>}
      </div>
      <ul className="divide-y divide-border">
        {shown.map((a) => <AlertRow key={a.id} websiteId={websiteId} alert={a} now={now} canAsk={canAsk} />)}
      </ul>
    </Card>
  );
}

function AlertRow({ websiteId, alert, now, canAsk }: { websiteId: string; alert: AlertView; now: number; canAsk: boolean }) {
  const t = useT().ai.alerts;
  const resolved = alert.status === 'resolved';
  const href = alertHref(websiteId, alert.path);
  const detail = alert.explanation ?? alert.summary;
  const when = resolved
    ? t.backToNormalAgo(relativeTime(alert.resolvedAt, now, t.time))
    : relativeTime(alert.detectedAt, now, t.time);

  return (
    <li className={cn('flex items-start gap-3 px-4 py-2.5', resolved && 'opacity-75')}>
      <span
        className={cn('mt-[0.45em] h-2 w-2 shrink-0 rounded-full', resolved ? 'bg-emerald-500' : SEVERITY_DOT[alert.severity])}
        title={resolved ? t.resolved : t.severityTitle(t.severity[alert.severity])}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="truncate text-[13px] font-medium text-foreground">{alert.title}</p>
          {when && <span className="text-[11px] text-muted-foreground">{when}</span>}
        </div>
        {detail && (
          <p className="truncate text-xs text-muted-foreground" title={detail}>
            {detail}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!resolved && canAsk && (
          <Link
            href={askWhyHref(websiteId, alert, t)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t.askWhy}
          </Link>
        )}
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {alertLinkLabel(alert.path, t.link)}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </li>
  );
}
