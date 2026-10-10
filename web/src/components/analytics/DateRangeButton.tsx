'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GHOST_CONTROL } from '@/components/ui/ghost-control';
import { formatDateSpan, formatRangeDates, formatShortDate } from '@/lib/range-dates';
import { cn } from '@/lib/utils';

/** The presets, as the Filters dialog's "Time Period" offers them — both write the same state. */
export const DATE_PRESETS = [
  { value: '0',      label: 'Today' },
  { value: '1',      label: 'Yesterday' },
  { value: '7',      label: 'Last 7 days' },
  { value: '14',     label: 'Last 14 days' },
  { value: '30',     label: 'Last 30 days' },
  { value: '90',     label: 'Last 90 days' },
  { value: '180',    label: 'Last 6 months' },
  { value: '365',    label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
] as const;

interface DateRangeButtonProps {
  dateRange: number;
  isCustomRange: boolean;
  customStartDate?: Date;
  customEndDate?: Date;
  onDateRangeChange: (value: string) => void;
  onCustomDateChange: (start: Date | undefined, end: Date | undefined) => void;
}

/** The dates a preset covers: one day for Today and Yesterday, otherwise a span ending now. */
function presetDates(days: number, now: Date): string {
  if (days === 1) return formatShortDate(new Date(now.getTime() - 86_400_000));
  return formatRangeDates(days, now);
}

/** Preset groups, divided the way Plausible's menu is. */
const PRESET_GROUPS: (typeof DATE_PRESETS)[number]['value'][][] = [
  ['0', '1'],
  ['7', '14', '30', '90'],
  ['180', '365'],
  ['custom'],
];

/**
 * A date picker for the analytics header, in the same ghost style as the controls beside it.
 *
 * The trigger shows the real dates the page is reading — "Sun, 27 Sep – Sat, 10 Oct" —
 * rather than the name of a preset, so it is clear what the numbers below cover.
 */
export function DateRangeButton({
  dateRange,
  isCustomRange,
  customStartDate,
  customEndDate,
  onDateRangeChange,
  onCustomDateChange,
}: DateRangeButtonProps) {
  const [open, setOpen] = useState(false);
  // Computed after mount: it comes from the clock, which the server and browser can
  // disagree on around midnight.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const activeValue = isCustomRange ? 'custom' : String(dateRange);

  let label = 'Select dates';
  if (isCustomRange) {
    label =
      customStartDate && customEndDate
        ? formatDateSpan(customStartDate, customEndDate)
        : 'Custom range';
  } else if (now) {
    label = presetDates(dateRange, now);
  } else {
    label = DATE_PRESETS.find((p) => p.value === activeValue)?.label ?? 'Select dates';
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          aria-label="Date range"
          className={cn(GHOST_CONTROL, 'h-8 gap-1.5 px-2.5 text-[13px]')}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">{label}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-auto p-1">
        <div className="flex flex-col sm:flex-row">
          <div className="flex min-w-[160px] flex-col" role="listbox" aria-label="Date presets">
            {PRESET_GROUPS.map((group, gi) => (
              <div key={gi} className={cn('flex flex-col gap-px', gi > 0 && 'mt-1 border-t border-border pt-1')}>
                {group.map((value) => {
                  const preset = DATE_PRESETS.find((p) => p.value === value)!;
                  const active = value === activeValue;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onDateRangeChange(value);
                        if (value !== 'custom') setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                        active ? 'bg-muted font-semibold text-foreground' : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      {preset.label}
                      {active && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {isCustomRange && (
            <div className="border-t border-border sm:ml-1.5 sm:border-l sm:border-t-0 sm:pl-1.5">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={customStartDate}
                selected={{ from: customStartDate, to: customEndDate }}
                onSelect={(r) => {
                  onCustomDateChange(r?.from, r?.to);
                  if (r?.from && r?.to) setOpen(false);
                }}
                numberOfMonths={1}
                disabled={{ after: new Date() }}
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
