'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { KanbanSquare, LayoutGrid, List, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

/** The ways a collection can be laid out. A page offers only the ones that earn their place. */
export type CollectionLayout = 'list' | 'table' | 'cards' | 'board';

/** Each layout's icon, and its English name (LayoutSwitch shows the name in the dashboard's language). */
export const LAYOUT_META: Record<CollectionLayout, { label: string; icon: ReactNode }> = {
  list: { label: 'List', icon: <List /> },
  table: { label: 'Table', icon: <Table2 /> },
  cards: { label: 'Cards', icon: <LayoutGrid /> },
  board: { label: 'Board', icon: <KanbanSquare /> },
};

/**
 * Icon buttons for the layouts a page offers, for the right end of its toolbar. Hidden when
 * there is only one: a switch with a single choice is noise.
 */
export function LayoutSwitch<L extends CollectionLayout>({
  layouts, value, onChange, labels,
}: {
  layouts: readonly L[];
  value: L;
  onChange: (layout: L) => void;
  /** Overrides a layout's name, e.g. Board for a pipeline's cards. */
  labels?: Partial<Record<L, string>>;
}) {
  const t = useT().ui.collection;
  if (layouts.length < 2) return null;
  return (
    <div role="group" aria-label={t.layout} className="flex gap-0.5 rounded-[7px] border border-border p-0.5">
      {layouts.map((l) => {
        const on = l === value;
        const label = labels?.[l] ?? t.layouts[l];
        return (
          <button
            key={l}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={on}
            onClick={() => onChange(l)}
            className={cn(
              'flex h-[22px] w-[26px] items-center justify-center rounded-[5px] transition-colors [&_svg]:size-3.5',
              on ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {LAYOUT_META[l].icon}
          </button>
        );
      })}
    </div>
  );
}

// v2: the list pages moved to table first; a choice saved before that is dropped once, so every
// page opens on the new default, and a choice made since is kept as before.
const STORAGE_PREFIX = 'seentics:layout:v2:';

/**
 * The layout a page shows, remembered per page in this browser. Storage can be missing or
 * blocked (private windows, previews), so it is a convenience: the page works without it.
 */
export function useLayoutPreference<L extends CollectionLayout>(key: string, layouts: readonly L[], fallback: L) {
  const [layout, setLayout] = useState<L>(fallback);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_PREFIX + key) as L | null;
      if (saved && layouts.includes(saved)) setLayout(saved);
    } catch {
      /* storage unavailable: keep the fallback */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const choose = useCallback((next: L) => {
    setLayout(next);
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, next);
    } catch {
      /* storage unavailable: the choice lasts for this visit */
    }
  }, [key]);

  return [layout, choose] as const;
}
