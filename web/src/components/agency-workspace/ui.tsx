'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Check, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DashboardPageTitle } from '@/components/dashboard/DashboardPageTitle';
import { domainErrorMessage, errorMessage } from '@/features/agency/api';
import { useT, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** The workspace's words in the current language. */
export const useAgencyT = () => useT().agency;

/** `errorMessage` in the current language. */
export function useErrorText(): (e: unknown) => string {
  const m = useT().agency.errors;
  return useCallback((e: unknown) => errorMessage(e, m), [m]);
}

/** `domainErrorMessage` in the current language. */
export function useDomainErrorText(): (e: unknown) => string {
  const m = useT().agency.domainErrors;
  return useCallback((e: unknown) => domainErrorMessage(e, m), [m]);
}

/** Intl locale for dates: Bangla month names with Latin digits; English as "5 Oct 2026". */
const dateLocale = (locale: Locale) => (locale === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB');

/** "5 Oct 2026" / "5 অক্টো, 2026"; `year: false` drops the year. */
export function shortDate(iso: string, locale: Locale, year = true): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
}

/** "3 hours ago" / "3 ঘণ্টা আগে", digits Latin. */
export function timeAgo(iso: string, locale: Locale): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  if (!Number.isFinite(seconds)) return '—';
  const rtf = new Intl.RelativeTimeFormat(locale === 'bn' ? 'bn-BD-u-nu-latn' : 'en', { numeric: 'auto' });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds), 'second');
}

/** The page frame every workspace page sits in: the dashboard's width, padding and title. */
export function WorkspacePage({ title, description, actions, before, children }: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Above the title: a back link. */
  before?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] p-4 md:p-5 lg:px-6 lg:py-5">
      {before}
      <DashboardPageTitle title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

/** A card with a heading row: the workspace's sections, tables and forms all sit in one. */
export function Panel({ title, description, actions, children, className, bodyClassName, ...rest }: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  'data-testid'?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)} {...rest}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </Card>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      {icon && <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingRow({ label }: { label?: string }) {
  const t = useAgencyT();
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label ?? t.common.loading}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

const TONES = {
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  red: 'bg-destructive/10 text-destructive',
  muted: 'bg-muted text-muted-foreground',
} as const;

export type Tone = keyof typeof TONES;

export function Pill({ tone = 'muted', children, ...rest }: { tone?: Tone; children: ReactNode; 'data-testid'?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', TONES[tone])} {...rest}>
      {children}
    </span>
  );
}

/** A client's status as a pill. */
export function StatusPill({ status }: { status: 'active' | 'suspended' | 'archived' }) {
  const t = useAgencyT();
  const tone = { active: 'green', suspended: 'amber', archived: 'muted' } as const;
  return <Pill tone={tone[status]}>{t.common.status[status]}</Pill>;
}

export function CopyButton({ text, label: given, className }: { text: string; label?: string; className?: string }) {
  const t = useAgencyT();
  const label = given ?? t.common.copy;
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button type="button" variant="outline" size="sm" aria-label={label} title={label} className={cn('h-8 w-8 shrink-0 p-0', className)} onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

/** A block of code with a copy button in its corner. */
export function CodeBlock({ code, label, className }: { code: string; label?: string; className?: string }) {
  const t = useAgencyT();
  return (
    <div className={cn('relative rounded-md border border-border bg-muted/40', className)}>
      <pre className="overflow-x-auto p-3 pr-12 font-mono text-[12px] leading-relaxed text-foreground"><code>{code}</code></pre>
      <CopyButton text={code} label={label ?? t.common.copyCode} className="absolute right-2 top-2 bg-card" />
    </div>
  );
}

/** A thin bar: how much of something is used. */
export function Meter({ value, max, className, label }: { value: number; max: number; className?: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn('h-full rounded-full', pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-amber-500' : 'bg-primary')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Change against the previous period: green up, red down. */
export function Change({ pct }: { pct: number | null }) {
  const t = useAgencyT();
  if (pct === null || !Number.isFinite(pct)) return <span className="text-xs text-muted-foreground">{t.common.newChange}</span>;
  const up = pct >= 0;
  return (
    <span className={cn('text-xs font-medium tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

export const compact = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export const percentOf = (used: number, total: number): string => (total > 0 ? `${Math.round((used / total) * 100)}%` : '—');

/** `value`, once it has stopped changing for `ms`: search boxes ask the API only when typing pauses. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
