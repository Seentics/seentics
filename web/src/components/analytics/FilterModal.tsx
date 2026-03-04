'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
  CalendarIcon,
  Filter,
  CheckCircle2,
  X,
  Clock,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Chrome,
  Link2,
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdvancedFilters {
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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { value: '0',   label: 'Today',         group: 0 },
  { value: '1',   label: 'Yesterday',     group: 0 },
  { value: '7',   label: 'Last 7 days',   group: 1 },
  { value: '14',  label: 'Last 14 days',  group: 1 },
  { value: '30',  label: 'Last 30 days',  group: 1 },
  { value: '90',  label: 'Last 90 days',  group: 1 },
  { value: '180', label: 'Last 6 months', group: 2 },
  { value: '365', label: 'Last 12 months',group: 2 },
  { value: 'custom', label: 'Custom range', group: 3 },
];

const DEVICE_OPTIONS  = ['Desktop', 'Mobile', 'Tablet'];
const BROWSER_OPTIONS = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera', 'Samsung'];
const OS_OPTIONS      = ['Windows', 'macOS', 'Linux', 'iOS', 'Android', 'ChromeOS'];
const UTM_MEDIUMS     = ['organic', 'cpc', 'email', 'social', 'referral', 'direct'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  open,
  onToggle,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 px-4 rounded-xl hover:bg-muted/40 transition-colors group"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-primary opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>
        <span className="text-xs font-black uppercase tracking-widest text-foreground/70 group-hover:text-foreground transition-colors">
          {title}
        </span>
        {badge != null && badge > 0 && (
          <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary/15 text-[10px] text-primary font-black">
            {badge}
          </span>
        )}
      </div>
      {open ? (
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

function ChipGroup({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: string[];
  value: string | string[] | undefined;
  onChange: (v: string | undefined) => void;
  multi?: boolean;
}) {
  const active = typeof value === 'string' ? [value] : (value ?? []);
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {options.map((opt) => {
        const isOn = active.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onChange(isOn ? undefined : opt)}
            className={cn(
              'h-7 px-3 rounded-full text-xs font-bold border transition-all duration-150 select-none',
              isOn
                ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20'
                : 'bg-muted/30 text-muted-foreground border-border/40 hover:border-primary/40 hover:text-foreground hover:bg-muted/60',
            )}
          >
            {opt}
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
        className="h-9 pr-8 bg-muted/20 border-border/30 text-sm placeholder:text-muted-foreground/50 rounded-lg focus-visible:ring-primary/40 focus-visible:border-primary/50"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
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
}: FilterModalProps) {
  const [open, setOpen] = useState(false);

  // Local advanced filter state (committed on Apply)
  const [draft, setDraft] = useState<AdvancedFilters>({});

  // Section collapse state
  const [sections, setSections] = useState({
    time: true,
    audience: true,
    traffic: false,
    content: false,
  });

  const toggleSection = (key: keyof typeof sections) =>
    setSections((s) => ({ ...s, [key]: !s[key] }));

  // Derived – count how many advanced filters are set
  const advancedCount = Object.values(draft).filter(Boolean).length;
  const totalCount = activeFiltersCount + advancedCount;

  // Active filter chips (for the tag row)
  const activeTags = Object.entries(draft)
    .filter(([, v]) => !!v)
    .map(([k, v]) => ({ key: k, label: `${k.replace(/_/g, ' ')}: ${v}` }));

  const currentDateValue = isCustomRange ? 'custom' : dateRange.toString();
  const dateLabel = DATE_PRESETS.find((p) => p.value === currentDateValue)?.label ?? 'Custom';

  function clearFilter(key: string) {
    setDraft((d) => {
      const next = { ...d };
      delete next[key as keyof AdvancedFilters];
      return next;
    });
  }

  function clearAll() {
    setDraft({});
    onDateRangeChange('7');
    onCustomDateChange(undefined, undefined);
    onFiltersChange?.({});
  }

  function applyAndClose() {
    onFiltersChange?.(draft);
    setOpen(false);
  }

  // Sync draft when parent resets filters from outside
  useEffect(() => {
    if (!open) return;
  }, [open]);

  const set = (key: keyof AdvancedFilters) => (val: string | undefined) =>
    setDraft((d) => {
      const next = { ...d };
      if (val) next[key] = val; else delete next[key];
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 px-4 bg-card/50 backdrop-blur-md hover:bg-card transition-all rounded shadow-sm font-bold text-xs uppercase tracking-widest gap-2 relative border border-border/50 active:scale-95 text-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
          Filters
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-black shadow-lg shadow-primary/20">
              {totalCount}
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px] rounded-2xl border border-border/20 bg-background shadow-2xl p-0 overflow-hidden outline-none max-h-[92vh] flex flex-col">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/10 bg-muted/5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <DialogTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                <SlidersHorizontal className="h-4.5 w-4.5 text-primary" />
                Advanced Filters
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Narrow your analytics data by time, audience, traffic source, and content.
              </p>
            </div>
            {totalCount > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/5"
              >
                <RotateCcw className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Active filter tags */}
          {activeTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {activeTags.map(({ key, label }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary"
                >
                  {label}
                  <button onClick={() => clearFilter(key)} className="hover:text-primary/60 transition-colors">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* ── Scrollable body ─────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 divide-y divide-border/10">

          {/* ── Section: Time Period ──────────────────────────────────── */}
          <div>
            <SectionHeader
              icon={<Clock className="h-4 w-4" />}
              title="Time Period"
              open={sections.time}
              onToggle={() => toggleSection('time')}
            />
            {sections.time && (
              <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Quick preset chips */}
                <div className="flex flex-wrap gap-1.5">
                  {DATE_PRESETS.map((p) => {
                    const isActive = p.value === currentDateValue;
                    return (
                      <button
                        key={p.value}
                        onClick={() => onDateRangeChange(p.value)}
                        className={cn(
                          'h-7 px-3 rounded-full text-xs font-bold border transition-all duration-150',
                          isActive
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20'
                            : 'bg-muted/30 text-muted-foreground border-border/40 hover:border-primary/40 hover:text-foreground hover:bg-muted/60',
                          p.value === 'custom' && !isActive && 'border-dashed',
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* Current selection summary */}
                {!isCustomRange && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                    <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-xs font-bold text-primary">{dateLabel}</span>
                  </div>
                )}

                {/* Custom calendar */}
                {isCustomRange && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {customStartDate && customEndDate
                        ? `${format(customStartDate, 'MMM d, yyyy')} → ${format(customEndDate, 'MMM d, yyyy')}`
                        : 'Pick start and end dates'}
                    </div>
                    <div className="rounded-xl border border-border/20 bg-muted/5 overflow-hidden">
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
            )}
          </div>

          {/* ── Section: Audience ─────────────────────────────────────── */}
          <div>
            <SectionHeader
              icon={<Globe className="h-4 w-4" />}
              title="Audience"
              open={sections.audience}
              onToggle={() => toggleSection('audience')}
              badge={[draft.country, draft.device, draft.browser, draft.os].filter(Boolean).length}
            />
            {sections.audience && (
              <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">

                {/* Country */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                    <Globe className="h-3 w-3" /> Country
                  </label>
                  <ClearableInput
                    placeholder="e.g. United States, Germany…"
                    value={draft.country ?? ''}
                    onChange={(v) => set('country')(v || undefined)}
                  />
                </div>

                {/* Device */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                    <Monitor className="h-3 w-3" /> Device
                  </label>
                  <ChipGroup
                    options={DEVICE_OPTIONS}
                    value={draft.device}
                    onChange={set('device')}
                  />
                </div>

                {/* Browser */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                    <Chrome className="h-3 w-3" /> Browser
                  </label>
                  <ChipGroup
                    options={BROWSER_OPTIONS}
                    value={draft.browser}
                    onChange={set('browser')}
                  />
                </div>

                {/* OS */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                    <Smartphone className="h-3 w-3" /> Operating System
                  </label>
                  <ChipGroup
                    options={OS_OPTIONS}
                    value={draft.os}
                    onChange={set('os')}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Section: Traffic Source ───────────────────────────────── */}
          <div>
            <SectionHeader
              icon={<Link2 className="h-4 w-4" />}
              title="Traffic Source"
              open={sections.traffic}
              onToggle={() => toggleSection('traffic')}
              badge={[draft.utm_source, draft.utm_medium, draft.utm_campaign].filter(Boolean).length}
            />
            {sections.traffic && (
              <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">

                {/* UTM Source */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    UTM Source
                  </label>
                  <ClearableInput
                    placeholder="e.g. google, newsletter, twitter…"
                    value={draft.utm_source ?? ''}
                    onChange={(v) => set('utm_source')(v || undefined)}
                  />
                </div>

                {/* UTM Medium – chips + free text */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    UTM Medium
                  </label>
                  <ChipGroup
                    options={UTM_MEDIUMS}
                    value={draft.utm_medium}
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    UTM Campaign
                  </label>
                  <ClearableInput
                    placeholder="e.g. spring_sale, product_launch…"
                    value={draft.utm_campaign ?? ''}
                    onChange={(v) => set('utm_campaign')(v || undefined)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Section: Content ──────────────────────────────────────── */}
          <div>
            <SectionHeader
              icon={<FileText className="h-4 w-4" />}
              title="Content"
              open={sections.content}
              onToggle={() => toggleSection('content')}
              badge={draft.page_path ? 1 : 0}
            />
            {sections.content && (
              <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    Page Path
                  </label>
                  <ClearableInput
                    placeholder="e.g. /blog, /pricing, /docs/…"
                    value={draft.page_path ?? ''}
                    onChange={(v) => set('page_path')(v || undefined)}
                  />
                  <p className="text-[10px] text-muted-foreground/60 px-0.5">
                    Partial match — shows pages starting with this path.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-border/10 bg-muted/5 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[10px] text-muted-foreground font-medium">
            {advancedCount > 0
              ? `${advancedCount} filter${advancedCount > 1 ? 's' : ''} applied`
              : 'No filters active'}
          </div>
          <div className="flex items-center gap-2">
            {advancedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft({})}
                className="h-9 px-4 text-xs font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl"
              >
                Reset filters
              </Button>
            )}
            <Button
              onClick={applyAndClose}
              className="h-9 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all gap-2"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Apply filters
            </Button>
          </div>
        </div>

        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/8 blur-[100px] -mr-24 -mt-24 rounded-full pointer-events-none" />
      </DialogContent>
    </Dialog>
  );
}
