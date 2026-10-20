'use client';

import { useState, type DragEvent, type ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { GroupHeader } from '@/components/ui/linear-list';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

/**
 * The layouts a collection can take, each fed the same items and told only how to draw one:
 * grouped rows, a table, a grid of cards and a board. Pages pick the ones that suit them and
 * pass their own renderers, so the look stays shared while the content is the page's.
 */

/** A group of items: the rows' headers, the board's columns. */
export interface CollectionGroup {
  id: string;
  label: string;
  /** A small status icon or dot. */
  icon?: ReactNode;
  /** The whole group's size when the page shows only part of it (the server's count). */
  count?: number;
}

interface Keyed<T> {
  items: T[];
  getKey: (item: T) => string;
}

/**
 * The panel lists and tables sit on: its own fill (white in light, a lifted grey in dark),
 * inset from the page, so the content reads apart from the toolbar and the page around it.
 * The last row's own line is dropped where the panel's border already closes it.
 */
export const COLLECTION_SURFACE = cn(
  // shrink-0: inside the page's flex column a clipped panel would otherwise shrink to the space
  // left and cut its rows off rather than grow the page. overflow-clip, not -hidden: it rounds the
  // corners the same but is no scroll box, so the toolbar inside can stick to the page's top.
  'm-3 shrink-0 overflow-clip rounded-lg border border-border bg-card md:m-4',
  '[&>section:last-child>ul>li:last-child>*]:border-b-0 [&>ul>li:last-child>*]:border-b-0 [&_tbody>tr:last-child]:border-b-0',
);

// ── Rows ─────────────────────────────────────────────────────────────────────

/**
 * Items as rows under folding group headers, Linear-style. Without `groups` it is one plain
 * list. Empty groups are left out.
 */
export function GroupedRows<T>({
  items, getKey, groups, groupOf, renderRow, header, toolbar,
}: Keyed<T> & {
  groups?: CollectionGroup[];
  groupOf?: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  /** A line above the rows inside the panel, such as column labels. */
  header?: ReactNode;
  /** The panel's top row: tabs and controls (FilterToolbar with `leading`). */
  toolbar?: ReactNode;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const rows = (list: T[]) => <ul>{list.map((item) => <li key={getKey(item)}>{renderRow(item)}</li>)}</ul>;
  if (!groups || !groupOf) return <div className={COLLECTION_SURFACE}>{toolbar}{header}{rows(items)}</div>;
  return (
    <div className={COLLECTION_SURFACE}>
      {toolbar}
      {header}
      {groups.map((g) => {
        const inGroup = items.filter((item) => groupOf(item) === g.id);
        if (inGroup.length === 0) return null;
        const open = !closed[g.id];
        return (
          <section key={g.id} aria-label={g.label}>
            <GroupHeader icon={g.icon} label={g.label} count={g.count ?? inGroup.length} open={open} onToggle={() => setClosed({ ...closed, [g.id]: open })} />
            {open && rows(inGroup)}
          </section>
        );
      })}
    </div>
  );
}

/** The usual row: a 48px line that opens the item. Pages put their own cells inside. */
export function CollectionRow({ onOpen, children, className }: { onOpen?: () => void; children: ReactNode; className?: string }) {
  return (
    // The whole row opens the item for a mouse; a button or link inside is the keyboard's way in.
    <div
      onClick={onOpen}
      className={cn(
        'group flex min-h-12 items-center gap-3 border-b border-border/40 py-1.5 pl-[34px] pr-4 transition-colors focus-within:bg-muted/40',
        onOpen && 'cursor-pointer hover:bg-muted/40',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

export interface CollectionColumn<T> {
  id: string;
  header: ReactNode;
  cell: (item: T) => ReactNode;
  /** A CSS width for the column; the rest share what is left. */
  width?: string;
  align?: 'left' | 'right';
  /** Marks the column the list is sorted by. */
  sorted?: boolean;
}

export interface RowSelection {
  selected: ReadonlySet<string>;
  onChange: (keys: string[], selected: boolean) => void;
  /** The checkbox's name for one item, e.g. its email. */
  labelOf: (key: string) => string;
}

/**
 * A dense table: sticky header, one line per item, columns that scroll sideways on a narrow
 * screen. Optional checkboxes for bulk actions.
 */
export function CollectionTable<T>({
  items, getKey, columns, onOpen, selection, minWidth = 900, label, rowClassName, toolbar,
}: Keyed<T> & {
  columns: CollectionColumn<T>[];
  onOpen?: (item: T) => void;
  selection?: RowSelection;
  /** Below this the table scrolls sideways rather than squeezing its columns. */
  minWidth?: number;
  label: string;
  /** Extra classes for each row, e.g. a taller row for two-line cells. */
  rowClassName?: string;
  /** The panel's top row: tabs and controls (FilterToolbar with `leading`); stays put while the table scrolls sideways. */
  toolbar?: ReactNode;
}) {
  const t = useT().ui.collection;
  const keys = items.map(getKey);
  const allOn = keys.length > 0 && keys.every((k) => selection?.selected.has(k));
  const someOn = !allOn && keys.some((k) => selection?.selected.has(k));
  const align = (c: CollectionColumn<T>) => (c.align === 'right' ? 'text-right' : 'text-left');

  return (
    <div className={COLLECTION_SURFACE}>
      {toolbar}
      <div className="overflow-x-auto">
      <table aria-label={label} className="w-full table-fixed border-collapse text-[13px]" style={{ minWidth }}>
        <colgroup>
          {selection && <col style={{ width: 44 }} />}
          {columns.map((c) => <col key={c.id} style={c.width ? { width: c.width } : undefined} />)}
        </colgroup>
        <thead>
          {/* The header on the panel's own white, labels a step stronger than the rows' grey. */}
          <tr className="h-10 border-b border-border/70 text-[12px] text-muted-foreground">
            {selection && (
              <th scope="col" className="pl-4 text-left font-medium">
                <Checkbox
                  aria-label={t.selectAllShown}
                  checked={allOn ? true : someOn ? 'indeterminate' : false}
                  onCheckedChange={(on) => selection.onChange(keys, !!on)}
                />
              </th>
            )}
            {columns.map((c, i) => (
              <th
                key={c.id}
                scope="col"
                aria-sort={c.sorted ? 'descending' : undefined}
                className={cn('px-3 font-medium', align(c), i === 0 && !selection && 'pl-4', i === columns.length - 1 && 'pr-4')}
              >
                {c.header}{c.sorted && <span aria-hidden> ↓</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const key = getKey(item);
            const on = selection?.selected.has(key) ?? false;
            return (
              <tr
                key={key}
                onClick={onOpen ? () => onOpen(item) : undefined}
                data-state={on ? 'selected' : undefined}
                className={cn(
                  'group h-12 border-b border-border/40 transition-colors focus-within:bg-muted/40 data-[state=selected]:bg-primary/[0.05]',
                  onOpen && 'cursor-pointer hover:bg-muted/40',
                  rowClassName,
                )}
              >
                {selection && (
                  <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox aria-label={t.selectItem(selection.labelOf(key))} checked={on} onCheckedChange={(v) => selection.onChange([key], !!v)} />
                  </td>
                )}
                {columns.map((c, i) => (
                  <td key={c.id} className={cn('truncate px-3', align(c), i === 0 && !selection && 'pl-4', i === columns.length - 1 && 'pr-4')}>
                    {c.cell(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────────

/** The card frame every card layout uses: a quiet bordered box that lifts on hover. */
// ── Tabs ─────────────────────────────────────────────────────────────────────

export interface CountTab<V extends string> {
  id: V;
  label: string;
  /** How many items the tab holds; left out while unknown. */
  count?: number;
}

/**
 * Views of one list, each with its count, as the panel's top row: "All 1,240 · Needs a look 32".
 * The chosen one is underlined against the row's bottom line.
 */
export function CountTabs<V extends string>({ tabs, value, onChange, label }: {
  tabs: CountTab<V>[];
  value: V;
  onChange: (value: V) => void;
  label: string;
}) {
  return (
    // A fixed height, not the row's: when the controls wrap below, the tabs keep their shape.
    <div role="tablist" aria-label={label} className="flex h-12 shrink-0 items-stretch gap-4 overflow-x-auto">
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 border-b-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              on ? 'border-foreground font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn('rounded-full px-1.5 py-px text-[11px] tabular-nums', on ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>
                {tab.count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const CARD = 'flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-foreground/20 focus-within:border-foreground/20';

/** Items as a responsive grid of cards. */
export function CardGrid<T>({
  items, getKey, renderCard, minCardWidth = 280, toolbar,
}: Keyed<T> & {
  renderCard: (item: T) => ReactNode;
  minCardWidth?: number;
  /** Tabs and controls (FilterToolbar with `leading`) on their own white bar above the cards, sticky like the list's. */
  toolbar?: ReactNode;
}) {
  const grid = (
    <ul className={cn('grid gap-3', toolbar ? 'pt-3' : 'p-4')} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minCardWidth}px), 1fr))` }}>
      {items.map((item) => <li key={getKey(item)}>{renderCard(item)}</li>)}
    </ul>
  );
  if (!toolbar) return grid;
  return (
    <div className="m-3 shrink-0 md:m-4 [&>div:first-child>div]:rounded-lg [&>div:first-child>div]:border-b-0">
      <div className="sticky top-0 z-10">{toolbar}</div>
      {grid}
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────

const DRAG_TYPE = 'application/x-seentics-item';

/**
 * Items as cards in columns, one per group: a pipeline. With `onMove` a card can be dragged
 * to another column; pages should also offer the change another way (the item's own menu or
 * page), since dragging needs a mouse.
 */
export function BoardView<T>({
  items, getKey, columns, columnOf, renderCard, onMove, columnWidth = 220,
}: Keyed<T> & {
  columns: CollectionGroup[];
  columnOf: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove?: (item: T, toColumn: string) => void;
  /** The narrowest a column gets; wider screens share the space out. */
  columnWidth?: number;
}) {
  const [over, setOver] = useState<string | null>(null);
  const byKey = new Map(items.map((item) => [getKey(item), item]));

  const drop = (column: string) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const item = byKey.get(e.dataTransfer.getData(DRAG_TYPE));
    if (item && onMove && columnOf(item) !== column) onMove(item, column);
  };

  return (
    <div className="flex flex-1 items-start gap-3 overflow-x-auto p-4">
      {columns.map((col) => {
        const inColumn = items.filter((item) => columnOf(item) === col.id);
        return (
          <section
            key={col.id}
            aria-label={col.label}
            onDragOver={onMove ? (e) => { e.preventDefault(); setOver(col.id); } : undefined}
            onDragLeave={onMove ? () => setOver((o) => (o === col.id ? null : o)) : undefined}
            onDrop={onMove ? drop(col.id) : undefined}
            className={cn('flex flex-1 basis-0 flex-col gap-2 rounded-lg p-1 transition-colors', over === col.id && 'bg-muted/60')}
            style={{ minWidth: columnWidth }}
          >
            <h2 className="flex h-7 items-center gap-2 px-1 text-[13px] font-medium text-foreground">
              {col.icon}{col.label}
              <span className="font-normal text-muted-foreground">{(col.count ?? inColumn.length).toLocaleString()}</span>
            </h2>
            <ul className="flex min-h-16 flex-col gap-2">
              {inColumn.map((item) => (
                <li
                  key={getKey(item)}
                  draggable={!!onMove}
                  onDragStart={onMove ? (e) => { e.dataTransfer.setData(DRAG_TYPE, getKey(item)); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                  className={cn(onMove && 'cursor-grab active:cursor-grabbing')}
                >
                  {renderCard(item)}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ── Around the layouts ───────────────────────────────────────────────────────

/** "26–50 of 120" with previous and next, under a paged collection. Hidden when it all fits. */
export function CollectionPager({
  page, pageSize, total, onChange, previousLabel, nextLabel,
}: { page: number; pageSize: number; total: number; onChange: (page: number) => void; previousLabel?: string; nextLabel?: string }) {
  const all = useT();
  if (total <= pageSize) return null;
  const first = page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);
  const button = 'inline-flex h-7 items-center rounded-md px-2 text-[12.5px] font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40';
  return (
    <nav aria-label={all.ui.collection.pages} className="flex h-10 items-center justify-between border-t border-border px-4 text-xs text-muted-foreground">
      <span className="tabular-nums">{all.ui.collection.range(first.toLocaleString(), last.toLocaleString(), total.toLocaleString())}</span>
      <span className="flex gap-1">
        <button type="button" className={button} disabled={page === 0} onClick={() => onChange(page - 1)}>{previousLabel ?? all.ui.collection.previous}</button>
        <button type="button" className={button} disabled={last >= total} onClick={() => onChange(page + 1)}>{nextLabel ?? all.ui.collection.next}</button>
      </span>
    </nav>
  );
}

/** What a collection shows with nothing in it. */
export function CollectionEmpty({ icon, title, description, action }: { icon: ReactNode; title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-center text-[13px]">
      <span className="text-muted-foreground/60 [&_svg]:size-5" aria-hidden>{icon}</span>
      <p className="font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Rows of placeholder while the first page loads. */
export function CollectionSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-px p-4" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />)}
    </div>
  );
}
