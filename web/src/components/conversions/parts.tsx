'use client';

/** Small pieces the Conversions page shares. */
import type { ConversionStatus, MatchKey } from '@/features/conversions/types';
import { cn } from '@/lib/utils';
import { MATCH_LABEL, PLATFORMS, STATUS_META } from './conversion-format';

/** A platform's monogram on a neutral tile; no brand logos, so it reads the same in both themes. */
export function PlatformMark({ platform, className }: { platform: keyof typeof PLATFORMS; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-[12px] font-semibold tracking-tight text-foreground/80',
        className,
      )}
    >
      {PLATFORMS[platform].monogram}
    </span>
  );
}

export function StatusLabel({ status, className }: { status: ConversionStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]', className)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

/** The keys a conversion was matched with, as quiet chips. */
export function MatchChips({ keys }: { keys: readonly MatchKey[] }) {
  if (keys.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex gap-1">
      {keys.map((k) => (
        <span key={k} className="whitespace-nowrap rounded border border-border px-1.5 py-px text-[11px] text-foreground/75">
          {MATCH_LABEL[k]}
        </span>
      ))}
    </span>
  );
}
