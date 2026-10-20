'use client';

import { useState } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GHOST_CONTROL } from '@/components/ui/ghost-control';
import { useRangeDates } from '@/lib/range-dates';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { UiMessages } from '@/lib/i18n/messages/ui-en';

export interface RangeOption {
  /** Rolling window length in days. */
  days: number;
  /** Omit for the standard wording in the dashboard's language ("Last 7 days", "Last 24 hours"). */
  label?: string;
}

/** The standard name of a rolling window: "Last 24 hours" for one day, "Last 30 days" otherwise. */
export function rangeLabel(days: number, t: UiMessages['ranges']): string {
  return days === 1 ? t.last24Hours : t.lastDays(days);
}

/**
 * A date filter for pages whose API takes a rolling number of days: a small calendar icon
 * and the dates the window covers, with a short menu of presets. The analytics header has
 * its own, richer picker (custom ranges); this is the plain one.
 */
export function RangeSelect({
  value,
  onChange,
  ranges,
}: {
  value: number;
  onChange: (days: number) => void;
  ranges: readonly RangeOption[];
}) {
  const [open, setOpen] = useState(false);
  const t = useT().ui.ranges;
  const dates = useRangeDates(value);
  const labelOf = (r: RangeOption) => r.label ?? rangeLabel(r.days, t);
  const current = ranges.find((r) => r.days === value);
  const fallback = current ? labelOf(current) : t.selectDates;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          aria-label={t.dateRange}
          className={cn(GHOST_CONTROL, 'h-8 gap-1.5 px-2.5 text-[13px]')}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">{dates ?? fallback}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-auto p-1">
        <div className="flex min-w-[160px] flex-col gap-px" role="listbox" aria-label={t.presets}>
          {ranges.map((r) => {
            const active = r.days === value;
            return (
              <button
                key={r.days}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(r.days);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                  active ? 'bg-muted font-semibold text-foreground' : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {labelOf(r)}
                {active && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
