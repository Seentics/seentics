'use client';

/**
 * Choose which pages the sidebar lists. Each switch applies at once; hidden pages still open
 * from a link or bookmark, and can be brought back here any time.
 */
import type React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { LOCKED, type NavId } from '@/features/sidebar/nav-prefs';
import { cn } from '@/lib/utils';

export type CustomizableItem = { id: NavId; label: string; icon: React.ElementType; hint: string };

export function SidebarCustomizeDialog({
  open, onOpenChange, items, hidden, onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly CustomizableItem[];
  hidden: readonly NavId[];
  onChange: (next: NavId[]) => void;
}) {
  const off = new Set(hidden);
  const shown = items.filter((i) => !off.has(i.id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="space-y-1 px-5 pb-4 pt-5 text-left">
          <DialogTitle>Customize sidebar</DialogTitle>
          <DialogDescription>
            Keep the pages you use. Hidden pages still open from a link, and you can bring them back here.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto border-y border-border">
          {items.map((item) => {
            const locked = LOCKED.has(item.id);
            const on = !off.has(item.id);
            const switchId = `sidebar-item-${item.id}`;
            return (
              <li key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border', on ? 'text-foreground/80' : 'text-muted-foreground/50')}>
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <label htmlFor={switchId} className={cn('min-w-0 flex-1', locked ? 'cursor-default' : 'cursor-pointer')}>
                  <span className={cn('block text-[13.5px] font-medium', on ? 'text-foreground' : 'text-muted-foreground')}>{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{locked ? 'Always shown' : item.hint}</span>
                </label>
                <Switch
                  id={switchId}
                  checked={on}
                  disabled={locked}
                  onCheckedChange={(checked) => onChange(checked ? hidden.filter((id) => id !== item.id) : [...hidden, item.id])}
                  aria-label={`Show ${item.label} in the sidebar`}
                />
              </li>
            );
          })}
        </ul>

        <DialogFooter className="flex-row items-center justify-between gap-2 px-5 py-3 sm:justify-between">
          <p className="text-xs text-muted-foreground">{shown} of {items.length} shown</p>
          <div className="flex gap-2">
            {hidden.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>Show all</Button>
            )}
            <Button type="button" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
