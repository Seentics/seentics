import { cn } from '@/lib/utils';

/**
 * The look of a menu that sits beside a page's content — the Agency sections, the Settings
 * sections. It is a panel on its own surface (white in light mode, the card colour in dark)
 * so it reads as a menu rather than as loose text on the page, with compact 13px items to
 * match the dashboard's other controls.
 *
 * Styles only: the two pages render links and buttons differently, so each keeps its own
 * markup and takes its classes from here.
 */
export const PAGE_MENU_PANEL = 'rounded-lg border border-border bg-card p-1.5';

/** A group heading inside the panel. */
export const PAGE_MENU_LABEL =
  'px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70';

/** One item, active or not. */
export function pageMenuItem(active: boolean, extra?: string) {
  return cn(
    'flex w-full shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors',
    active
      ? 'bg-primary/10 text-primary dark:bg-accent dark:text-foreground'
      : 'text-foreground/70 hover:bg-muted/60 hover:text-foreground',
    extra,
  );
}
