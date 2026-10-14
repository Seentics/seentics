'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type ListGroupItem = { key: string; text: string; meta?: string; onClick?: () => void };
export type ListGroup = {
  id: string;
  label: string;
  description: string;
  /** Tailwind class for the group's dot. */
  dot: string;
  items: ListGroupItem[];
};

const PREVIEW = 10;

/**
 * Groups shown below a page's main list: each a row with its count that opens into its items,
 * one line each, with "Show all" narrowing the list above. Empty groups are left out.
 */
export function ListGroups({
  title, description, groups, onShowAll, className,
}: {
  title: string;
  description: string;
  groups: ListGroup[];
  onShowAll?: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const shown = groups.filter((g) => g.items.length > 0);
  if (shown.length === 0) return null;

  return (
    <Card className={cn('divide-y divide-border border border-border bg-card', className)}>
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {shown.map((g) => (
        <div key={g.id}>
          <button
            type="button"
            onClick={() => setOpen(open === g.id ? null : g.id)}
            aria-expanded={open === g.id}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open === g.id && 'rotate-90')} />
            <span className={cn('h-2 w-2 shrink-0 rounded-full', g.dot)} />
            <span className="text-sm font-medium">{g.label}</span>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">{g.description}</span>
            <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
              {g.items.length.toLocaleString()}
            </span>
          </button>
          {open === g.id && (
            <div className="bg-muted/20 pb-2">
              <ul>
                {g.items.slice(0, PREVIEW).map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={item.onClick}
                      disabled={!item.onClick}
                      className="flex w-full items-center gap-3 px-11 py-1.5 text-left hover:bg-muted/50 disabled:cursor-default"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm" title={item.text}>{item.text}</span>
                      {item.meta && <span className="shrink-0 text-xs text-muted-foreground">{item.meta}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              {onShowAll && g.items.length > 1 && (
                <button
                  type="button"
                  onClick={() => onShowAll(g.id)}
                  className="ml-11 mt-1 text-xs font-medium text-primary hover:underline"
                >
                  Show all {g.items.length.toLocaleString()} in the list above
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
