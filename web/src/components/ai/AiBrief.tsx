'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { useAlerts } from '@/features/ai/alerts/queries';
import { askWhyHref, bannerAlerts } from '@/features/ai/alerts/format';
import { useDailyInsight } from '@/features/ai/insights/queries';
import { useRecommendations } from '@/features/ai/recommendations/queries';
import { buildAskAiHref } from '@/features/ai/ask-link';
import { cn } from '@/lib/utils';

type BriefLine = { key: string; tone: 'alert' | 'finding' | 'action'; text: string; href: string; cta: string };

const MAX_LINES = 3;

/**
 * The AI's read of the site, in at most three lines, above the dashboard's numbers.
 *
 * The worst open alert first, then today's main finding, then the one thing to do next. The full
 * alerts, insight and recommendations are on the AI Reports page, so the dashboard stays a dashboard.
 */
export function AiBrief({ websiteId }: { websiteId: string }) {
  const alerts = useAlerts(websiteId);
  const insight = useDailyInsight(websiteId);
  const recs = useRecommendations(websiteId);

  const lines: BriefLine[] = [];
  const openAlert = alerts.data
    ? bannerAlerts(alerts.data.alerts).shown.find((a) => a.status === 'open')
    : undefined;
  if (openAlert) {
    lines.push({ key: `alert-${openAlert.id}`, tone: 'alert', text: openAlert.title, href: askWhyHref(websiteId, openAlert), cta: 'Ask why' });
  }
  const insightLines = insight.data?.status === 'ready' ? insight.data.lines : [];
  for (const l of insightLines.filter((x) => x.kind === 'finding')) {
    if (lines.length >= MAX_LINES - 1) break;
    lines.push({ key: `finding-${l.text}`, tone: 'finding', text: l.text, href: buildAskAiHref(websiteId, `Tell me more: ${l.text}`, 'Insight'), cta: 'Ask AI' });
  }
  const action = insightLines.find((x) => x.kind === 'action' && x.action);
  const rec = recs.data?.find((r) => r.status === 'open');
  if (lines.length < MAX_LINES && action?.action) {
    lines.push({ key: 'action', tone: 'action', text: action.text, href: buildAskAiHref(websiteId, action.action.prompt, 'Suggestion'), cta: 'Ask AI' });
  } else if (lines.length < MAX_LINES && rec) {
    lines.push({ key: `rec-${rec.id}`, tone: 'action', text: rec.title, href: buildAskAiHref(websiteId, rec.prompt, 'Recommendation', rec.id), cta: 'Do it' });
  }

  if (lines.length === 0) return null;

  // One line, not a panel: each point cut to its first clause, joined with dots.
  const parts = lines.slice(0, MAX_LINES).map((l) => ({ ...l, short: briefPhrase(l.text, l.tone) }));
  const alertPart = parts.find((p) => p.tone === 'alert');

  return (
    <div className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
      {alertPart ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-500" />
      ) : (
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
      )}
      <p className="min-w-0 flex-1 truncate text-muted-foreground" title={parts.map((p) => p.text).join(' · ')}>
        {parts.map((p, i) => (
          <span key={p.key}>
            {i > 0 && <span className="px-1.5 text-muted-foreground/50">·</span>}
            <Link href={p.href} className={cn('hover:underline', p.tone === 'alert' ? 'font-medium text-foreground' : 'text-foreground/90')}>
              {p.short}
            </Link>
          </span>
        ))}
      </p>
      <Link
        href={`/websites/${websiteId}/ai-reports`}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Details <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

/** A point cut to its first clause, so three fit on one line; actions read as "Next: …". */
export function briefPhrase(text: string, tone: BriefLine['tone']): string {
  const first = text.split(/(?<=[a-z0-9%)])[,;:.](?:\s|$)| — | or /i)[0]!.trim();
  const cut = first.length > 70 ? `${first.slice(0, 67).trimEnd()}…` : first;
  if (tone !== 'action') return cut;
  return `Next: ${cut.charAt(0).toLowerCase()}${cut.slice(1)}`;
}
