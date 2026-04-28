'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import {
  CalendarIcon,
  X,
  RotateCcw,
  SlidersHorizontal,
  Check,
  ChevronsUpDown,
  Search,
  Monitor,
  Smartphone,
  Tablet,
} from 'lucide-react';
import {
  SiGooglechrome,
  SiFirefoxbrowser,
  SiSafari,
  SiOpera,
  SiSamsung,
  SiMacos,
  SiLinux,
  SiIos,
  SiAndroid,
} from 'react-icons/si';
import { FaEdge, FaWindows } from 'react-icons/fa6';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { COUNTRIES } from '@/utils/countries';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdvancedFilters {
  country?: string;
  device?: string;
  browser?: string;
  os?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  page_path?: string;
}

interface FilterModalProps {
  dateRange: number;
  isCustomRange: boolean;
  customStartDate?: Date;
  customEndDate?: Date;
  onDateRangeChange: (value: string) => void;
  onCustomDateChange: (start: Date | undefined, end: Date | undefined) => void;
  onFiltersChange?: (filters: AdvancedFilters) => void;
  activeFiltersCount?: number;
  currentFilters?: AdvancedFilters;
}

type ChipOption = {
  label: string;
  icon?: React.ReactNode;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { value: '0',      label: 'Today' },
  { value: '1',      label: 'Yesterday' },
  { value: '7',      label: '7 days' },
  { value: '14',     label: '14 days' },
  { value: '30',     label: '30 days' },
  { value: '90',     label: '90 days' },
  { value: '180',    label: '6 months' },
  { value: '365',    label: '12 months' },
  { value: 'custom', label: 'Custom' },
];

const DEVICE_OPTIONS: ChipOption[] = [
  { label: 'Desktop', icon: <Monitor className="h-3 w-3" /> },
  { label: 'Mobile',  icon: <Smartphone className="h-3 w-3" /> },
  { label: 'Tablet',  icon: <Tablet className="h-3 w-3" /> },
];

const BROWSER_OPTIONS: ChipOption[] = [
  { label: 'Chrome',  icon: <SiGooglechrome className="h-3 w-3" /> },
  { label: 'Firefox', icon: <SiFirefoxbrowser className="h-3 w-3" /> },
  { label: 'Safari',  icon: <SiSafari className="h-3 w-3" /> },
  { label: 'Edge',    icon: <FaEdge className="h-3 w-3" /> },
  { label: 'Opera',   icon: <SiOpera className="h-3 w-3" /> },
  { label: 'Samsung', icon: <SiSamsung className="h-3 w-3" /> },
];

const OS_OPTIONS: ChipOption[] = [
  { label: 'Windows',   icon: <FaWindows className="h-3 w-3" /> },
  { label: 'macOS',     icon: <SiMacos className="h-3 w-3" /> },
  { label: 'Linux',     icon: <SiLinux className="h-3 w-3" /> },
  { label: 'iOS',       icon: <SiIos className="h-3 w-3" /> },
  { label: 'Android',   icon: <SiAndroid className="h-3 w-3" /> },
  { label: 'ChromeOS',  icon: <SiGooglechrome className="h-3 w-3" /> },
];

const UTM_MEDIUMS     = ['organic', 'cpc', 'email', 'social', 'referral', 'direct'];

const FILTER_LABELS: Record<string, string> = {
  country:      'Country',
  device:       'Device',
  browser:      'Browser',
  os:           'OS',
  utm_source:   'UTM Source',
  utm_medium:   'UTM Medium',
  utm_campaign: 'UTM Campaign',
  page_path:    'Page Path',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert ISO 2-letter code to emoji flag e.g. "US" → "🇺🇸" */
function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join('');
}

const COUNTRY_LIST = Object.values(COUNTRIES).sort((a, b) =>
  a.name.localeCompare(b.name),
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: ChipOption[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isOn = value === opt.label;
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(isOn ? undefined : opt.label)}
            className={cn(
              'h-7 px-3 rounded-md text-xs font-medium border transition-all duration-100 select-none flex items-center gap-1.5',
              isOn
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-border/80 hover:text-foreground hover:bg-muted/50',
            )}
          >
            {opt.icon && (
              <span className={cn('shrink-0', isOn ? 'text-primary-foreground' : 'text-muted-foreground/70')}>
                {opt.icon}
              </span>
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ClearableInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 pr-8 text-sm placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/40"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function CountrySelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRY_LIST;
    return COUNTRY_LIST.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const selected = value ? COUNTRIES[value] ?? null : null;

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full h-8 px-3 flex items-center justify-between gap-2 rounded-md border text-sm transition-colors',
            'border-border bg-transparent hover:bg-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
            !selected && 'text-muted-foreground/50',
          )}
        >
          {selected ? (
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-base leading-none">{flagEmoji(selected.code)}</span>
              <span className="truncate text-foreground">{selected.name}</span>
            </span>
          ) : (
            <span>Select country…</span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[260px] p-0 shadow-md border border-border/60 rounded-lg"
        align="start"
        sideOffset={4}
      >
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search country…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-muted-foreground/50 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Clear selection */}
        {selected && (
          <button
            type="button"
            onClick={() => { onChange(undefined); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 border-b border-border/40 transition-colors"
          >
            <X className="h-3 w-3" />
            Clear selection
          </button>
        )}

        {/* Scrollable list — plain div to avoid Radix ScrollArea quirks inside Dialog+Popover */}
        <div className="max-h-52 overflow-y-auto overscroll-contain">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">No countries found</p>
          ) : (
            <div className="py-1">
              {filtered.map((c) => {
                const isSelected = value === c.name;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => { onChange(c.name); setOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/50 text-foreground',
                    )}
                  >
                    <span className="text-base leading-none w-5 text-center">{flagEmoji(c.code)}</span>
                    <span className="flex-1 text-left truncate">{c.name}</span>
                    {isSelected && <Check className="h-3 w-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FilterModal({
  dateRange,
  isCustomRange,
  customStartDate,
  customEndDate,
  onDateRangeChange,
  onCustomDateChange,
  onFiltersChange,
  activeFiltersCount = 0,
  currentFilters = {},
}: FilterModalProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AdvancedFilters>({});

  // Sync draft from applied filters each time the modal opens
  useEffect(() => {
    if (open) setDraft(currentFilters);
  }, [open]);

  const advancedCount = Object.values(draft).filter(Boolean).length;
  const totalCount = activeFiltersCount;
  const currentDateValue = isCustomRange ? 'custom' : dateRange.toString();
  const activeDraftTags = Object.entries(draft).filter(([, v]) => !!v);

  const set = (key: keyof AdvancedFilters) => (val: string | undefined) =>
    setDraft((d) => {
      const next = { ...d };
      if (val) next[key] = val;
      else delete next[key];
      return next;
    });

  function clearFilter(key: string) {
    setDraft((d) => { const n = { ...d }; delete n[key as keyof AdvancedFilters]; return n; });
  }

  function resetAll() {
    setDraft({});
    onDateRangeChange('7');
    onCustomDateChange(undefined, undefined);
    onFiltersChange?.({});
  }

  function applyAndClose() {
    onFiltersChange?.(draft);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-8 px-3 text-xs font-medium gap-1.5 relative border-border/50 bg-card/50 hover:bg-card text-muted-foreground hover:text-foreground"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filters</span>
          {totalCount > 0 && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
              {totalCount}
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px] p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden rounded-xl border border-border/60">

        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/50 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Filters
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Narrow your analytics by time, audience, traffic source, and content.
              </p>
            </div>
            {(totalCount > 0 || advancedCount > 0) && (
              <button
                type="button"
                onClick={resetAll}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
              >
                <RotateCcw className="h-3 w-3" />
                Reset all
              </button>
            )}
          </div>

          {/* Active filter tags */}
          {activeDraftTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/40">
              {activeDraftTags.map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary"
                >
                  <span className="text-primary/70 font-normal">{FILTER_LABELS[key] ?? key}:</span>
                  <span>{String(value)}</span>
                  <button type="button" onClick={() => clearFilter(key)} className="ml-0.5 hover:text-primary/60 transition-colors">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

          {/* Time Period */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground">Time Period</p>
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map((p) => {
                const isActive = p.value === currentDateValue;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onDateRangeChange(p.value)}
                    className={cn(
                      'h-7 px-3 rounded-md text-xs font-medium border transition-all duration-100',
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:border-border/80 hover:text-foreground hover:bg-muted/50',
                      p.value === 'custom' && !isActive && 'border-dashed',
                    )}
                  >
                    {isActive && <Check className="inline h-2.5 w-2.5 mr-1 -mt-0.5" />}
                    {p.label}
                  </button>
                );
              })}
            </div>

            {!isCustomRange && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border/50">
                <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs text-foreground font-medium">
                  {DATE_PRESETS.find((p) => p.value === currentDateValue)?.label ?? 'Custom'}
                </span>
              </div>
            )}

            {isCustomRange && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {customStartDate && customEndDate
                    ? `${format(customStartDate, 'MMM d, yyyy')} → ${format(customEndDate, 'MMM d, yyyy')}`
                    : 'Select start and end dates'}
                </p>
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customStartDate}
                    selected={{ from: customStartDate, to: customEndDate }}
                    onSelect={(r) => onCustomDateChange(r?.from, r?.to)}
                    numberOfMonths={1}
                    className="w-full"
                    disabled={{ after: new Date() }}
                  />
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-border/50" />

          {/* Country */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Country</p>
            <CountrySelect value={draft.country} onChange={set('country')} />
          </div>

          {/* Device */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Device</p>
            <ChipGroup options={DEVICE_OPTIONS} value={draft.device} onChange={set('device')} />
          </div>

          {/* Browser */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Browser</p>
            <ChipGroup options={BROWSER_OPTIONS} value={draft.browser} onChange={set('browser')} />
          </div>

          {/* OS */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Operating System</p>
            <ChipGroup options={OS_OPTIONS} value={draft.os} onChange={set('os')} />
          </div>

          <Separator className="bg-border/50" />

          {/* UTM Source */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">UTM Source</p>
            <ClearableInput
              placeholder="e.g. google, newsletter, twitter…"
              value={draft.utm_source ?? ''}
              onChange={(v) => set('utm_source')(v || undefined)}
            />
          </div>

          {/* UTM Medium */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">UTM Medium</p>
            <ChipGroup
              options={UTM_MEDIUMS.map((m) => ({ label: m }))}
              value={UTM_MEDIUMS.includes(draft.utm_medium ?? '') ? draft.utm_medium : undefined}
              onChange={set('utm_medium')}
            />
            <ClearableInput
              placeholder="Or type a custom medium…"
              value={UTM_MEDIUMS.includes(draft.utm_medium ?? '') ? '' : (draft.utm_medium ?? '')}
              onChange={(v) => set('utm_medium')(v || undefined)}
            />
          </div>

          {/* UTM Campaign */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">UTM Campaign</p>
            <ClearableInput
              placeholder="e.g. spring_sale, product_launch…"
              value={draft.utm_campaign ?? ''}
              onChange={(v) => set('utm_campaign')(v || undefined)}
            />
          </div>

          <Separator className="bg-border/50" />

          {/* Page Path */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Page Path</p>
            <ClearableInput
              placeholder="e.g. /blog, /pricing, /docs/…"
              value={draft.page_path ?? ''}
              onChange={(v) => set('page_path')(v || undefined)}
            />
            <p className="text-[10px] text-muted-foreground/60">Partial match — shows pages starting with this path.</p>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 border-t border-border/50 flex items-center justify-between gap-3 shrink-0 bg-muted/20">
          <p className="text-xs text-muted-foreground">
            {advancedCount > 0
              ? `${advancedCount} filter${advancedCount > 1 ? 's' : ''} selected`
              : 'No filters selected'}
          </p>
          <div className="flex items-center gap-2">
            {advancedCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDraft({})}
                className="h-8 px-3 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5"
              >
                Clear
              </Button>
            )}
            <Button type="button" onClick={applyAndClose} size="sm" className="h-8 px-4 text-xs font-medium">
              Apply filters
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
