'use client';

/**
 * How the conversions sent were matched: the share carrying each key. The click ID matters most;
 * an email or phone helps when there is none.
 */
import Link from 'next/link';
import { MATCH_KEYS, type ConversionSummary } from '@/features/conversions/types';
import { MATCH_HINT, MATCH_LABEL, matchTip, percent } from './conversion-format';

export function MatchQuality({ match }: { match: ConversionSummary['match'] }) {
  const tip = matchTip(match);
  return (
    <div className="space-y-3">
      <ul className="space-y-2.5">
        {MATCH_KEYS.map((k) => {
          const share = percent(match[k], match.total);
          return (
            <li key={k} className="grid grid-cols-[110px_1fr_44px] items-center gap-3 sm:grid-cols-[130px_1fr_48px]">
              <span className="text-[13px] text-foreground" title={MATCH_HINT[k]}>{MATCH_LABEL[k]}</span>
              <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full bg-primary/80" style={{ width: `${share}%` }} />
              </span>
              <span className="text-right text-[13px] tabular-nums text-muted-foreground">{share}%</span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {match.total === 0
          ? 'Shares appear once conversions have been sent.'
          : `Of ${match.total.toLocaleString()} conversions sent in this period. More keys means more of them credited to the right ad.`}
      </p>
      {tip && (
        <p className="flex items-start gap-2 text-xs text-foreground/80">
          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
          <span>{tip} <Link href="/docs/conversions#email" className="font-medium text-primary hover:underline">How</Link></span>
        </p>
      )}
    </div>
  );
}
