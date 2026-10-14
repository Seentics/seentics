'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Lightbulb, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
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

  return (
    <Card className="border border-border bg-card px-4 py-3">
      <ul className="space-y-1.5">
        {lines.slice(0, MAX_LINES).map((l) => (
          <li key={l.key} className="flex items-center gap-2.5 text-sm">
            {l.tone === 'alert' ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-500" />
            ) : l.tone === 'action' ? (
              <Lightbulb className="h-3.5 w-3.5 shrink-0 text-primary" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className={cn('min-w-0 flex-1 truncate', l.tone === 'alert' && 'font-medium')} title={l.text}>
              {l.text}
            </span>
            <Link href={l.href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
              {l.cta} <ArrowRight className="h-3 w-3" />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={`/websites/${websiteId}/ai-reports`}
        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        All AI reports <ArrowRight className="h-3 w-3" />
      </Link>
    </Card>
  );
}
