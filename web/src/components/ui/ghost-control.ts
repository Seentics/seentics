/**
 * The look of a page-level control — a date range, a filter, a toggle — that sits on the
 * page background: no border, no shadow, no fill. Only a soft tint appears on hover and
 * while its menu is open, so a row of them reads as plain text with chevrons rather than
 * as a row of boxes.
 *
 * The text stays at full contrast: muted text on a transparent control reads as disabled.
 *
 * Pass it through `cn()` so it wins over the trigger's own border and background.
 */
export const GHOST_CONTROL =
  'border-0 bg-transparent shadow-none dark:bg-transparent dark:border-0 text-foreground font-medium hover:bg-muted/60 hover:text-foreground focus:ring-0 focus-visible:ring-0 focus-visible:bg-muted/60 data-[state=open]:bg-muted/60';
