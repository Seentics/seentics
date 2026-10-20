'use client';

import type { ReactNode } from 'react';
import { ArrowDownWideNarrow, ListFilter, Plus, Search, X } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export interface FilterOption {
  value: string;
  label: string;
  /** A dot or icon before the label, in the menu and the chip. */
  icon?: ReactNode;
}

/**
 * One field a list can be filtered on, with one value at a time: "Status is Customer".
 * `value` '' means the filter is not applied.
 */
export interface FilterField {
  id: string;
  label: string;
  /** The word between field and value on the chip; "is" by default. */
  op?: string;
  icon?: ReactNode;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export interface SortControl {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

const BUTTON = 'inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[12.5px] font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-3.5';
const MENU_TEXT = 'text-[13px]';

/**
 * A list's toolbar as Attio lays it out: on the left how it is sorted, the Filter menu, each
 * applied filter as a chip you can change or remove, "+ Add filter", and search; on the right
 * the count and whatever the page adds (its layout switch).
 */
export function FilterToolbar({
  sort, filters = [], search, count, children, leading,
}: {
  sort?: SortControl;
  filters?: FilterField[];
  search?: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string };
  /** "12 people": shown before the right-hand controls. */
  count?: ReactNode;
  /** The right end: the layout switch, page actions. */
  children?: ReactNode;
  /**
   * Tabs on the left (CountTabs). With them the toolbar becomes the top row of the list's own
   * panel: tabs left, every control right, one line under it. Pass it as the panel's `toolbar`.
   */
  leading?: ReactNode;
}) {
  const all = useT();
  const t = all.ui.collection;
  const applied = filters.filter((f) => f.value !== '');
  const unapplied = filters.filter((f) => f.value === '');
  const sortLabel = sort?.options.find((o) => o.value === sort.value)?.label;

  // In the panel's top row the controls are a step taller (32px), to sit level with the tabs.
  const button = cn(BUTTON, leading && 'h-8');
  const controls = (
    <>
      {sort && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={button}>
              <ArrowDownWideNarrow aria-hidden />
              <span className="font-normal text-muted-foreground">{t.sortedBy}</span> {sortLabel}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t.sortBy}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort.value} onValueChange={sort.onChange}>
              {sort.options.map((o) => <DropdownMenuRadioItem key={o.value} value={o.value} className={MENU_TEXT}>{o.label}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {filters.length > 0 && (
        <FilterMenu fields={filters} trigger={<button type="button" className={button}><ListFilter aria-hidden />{all.actions.filter}</button>} />
      )}

      {applied.length > 0 && <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />}
      {applied.map((f) => <FilterChip key={f.id} field={f} />)}
      {applied.length > 0 && unapplied.length > 0 && (
        <FilterMenu
          fields={unapplied}
          trigger={
            <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Plus className="size-3.5" aria-hidden />{t.addFilter}
            </button>
          }
        />
      )}

      {search && (
        <label className={cn('relative flex items-center', !leading && 'ml-1')}>
          <span className="sr-only">{search.label ?? all.actions.search}</span>
          <Search className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" aria-hidden />
          <input
            type="search"
            placeholder={search.placeholder ?? all.actions.searchPlaceholder}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            className={cn(
              'rounded-md border pl-7 pr-2 text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground',
              leading
                ? 'h-8 w-60 border-input bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04)] focus:border-foreground/40'
                : 'h-7 w-64 border-transparent bg-transparent hover:bg-muted focus:border-border focus:bg-transparent',
            )}
          />
        </label>
      )}
    </>
  );

  if (leading) {
    return (
      // Sticks to the top of the page while the rows scroll under it.
      <div className="sticky top-0 z-10 flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 rounded-t-lg border-b border-border/70 bg-card px-4">
        {leading}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 py-2">
          {controls}
          {count != null && <span className="text-xs text-muted-foreground">{count}</span>}
          {children}
        </div>
      </div>
    );
  }

  return (
    // No line below: the list or table under it sits on its own panel.
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 px-4 pb-0 pt-2">
      {controls}
      <div className="ml-auto flex items-center gap-2">
        {count != null && <span className="text-xs text-muted-foreground">{count}</span>}
        {children}
      </div>
    </div>
  );
}

/** The fields, each opening its values. */
function FilterMenu({ fields, trigger }: { fields: FilterField[]; trigger: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {fields.map((f) => (
          <DropdownMenuSub key={f.id}>
            <DropdownMenuSubTrigger className={cn(MENU_TEXT, 'gap-2 [&>svg:first-child]:size-3.5 [&>svg:first-child]:text-muted-foreground')}>
              {f.icon}{f.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 min-w-44 overflow-y-auto">
              <OptionItems field={f} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OptionItems({ field }: { field: FilterField }) {
  const t = useT().ui.collection;
  if (field.options.length === 0) return <DropdownMenuItem disabled className={MENU_TEXT}>{t.nothingToFilter}</DropdownMenuItem>;
  return (
    <DropdownMenuRadioGroup value={field.value} onValueChange={field.onChange}>
      {field.options.map((o) => (
        <DropdownMenuRadioItem key={o.value} value={o.value} className={cn(MENU_TEXT, 'gap-2')}>
          {o.icon}{o.label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

/** "Status is Customer ×": the value opens the other values; × removes the filter. */
function FilterChip({ field }: { field: FilterField }) {
  const t = useT().ui.collection;
  const current = field.options.find((o) => o.value === field.value);
  const valueLabel = current?.label ?? field.value;
  const op = field.op ?? t.is;
  return (
    <span className="inline-flex h-7 items-center rounded-md border border-primary/25 bg-primary/[0.06] pl-2 text-[12.5px] text-foreground/80">
      <span className="text-foreground">{field.label}</span>
      <span className="mx-1 text-muted-foreground">{op}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={t.changeFilter(field.label, valueLabel)} className="inline-flex items-center gap-1.5 rounded px-0.5 font-medium text-foreground hover:bg-primary/10">
            {current?.icon}{valueLabel}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 min-w-44 overflow-y-auto">
          <OptionItems field={field} />
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        onClick={() => field.onChange('')}
        aria-label={t.removeFilter(`${field.label} ${op} ${valueLabel}`)}
        className="ml-0.5 flex h-full w-6 items-center justify-center rounded-r-md text-muted-foreground hover:bg-primary/10 hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
