'use client';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useRecommendations } from '@/features/ai/recommendations/queries';
import { impactHighlight, impactTone } from '@/features/ai/recommendations/helpers';
import { cn } from '@/lib/utils';

/**
 * One line on the insight card about a change you made: "Your change on /pricing: bounce rate
 * −6 pts after 14 days (52% → 46%)". Only a reading that says something (a move, or a clear "no
 * change"); nothing while it is too early or the traffic too thin. Shares the panel's query.
 */
export function ImpactHighlight({ websiteId, className }: { websiteId: string; className?: string }) {
  const list = useRecommendations(websiteId);
  const rec = list.data ? impactHighlight(list.data) : null;
  if (!rec) return null;
  const tone = impactTone(rec.report.verdict);
  const Icon = tone === 'good' ? TrendingUp : tone === 'bad' ? TrendingDown : Minus;
  return (
    <p
      className={cn('flex gap-2 text-[13px] leading-relaxed text-foreground', className)}
      title={rec.report.caveats.join(' ')}
    >
      <Icon
        className={cn(
          'mt-[0.3em] h-3.5 w-3.5 shrink-0',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'bad' && 'text-destructive',
          tone === 'neutral' && 'text-muted-foreground',
        )}
      />
      <span className="min-w-0">{rec.report.headline}</span>
    </p>
  );
}
