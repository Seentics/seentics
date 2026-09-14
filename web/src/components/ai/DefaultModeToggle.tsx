'use client';

import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DefaultModeToggleProps {
  isDefault: boolean;
  onToggle: () => void;
  /** Hidden until the stored preference has been read, to avoid a flicker on load. */
  ready?: boolean;
  className?: string;
}

/**
 * Marks AI mode as this website's landing page.
 *
 * Per website and per browser — see `features/ai/default-mode`. The label says what
 * happens rather than naming the state, because "Default" alone does not tell someone
 * what clicking it will do.
 */
export function DefaultModeToggle({ isDefault, onToggle, ready = true, className }: DefaultModeToggleProps) {
  if (!ready) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-pressed={isDefault}
      title={isDefault
        ? 'This website opens in AI mode. Click to open the dashboard instead.'
        : 'Open this website in AI mode by default.'}
      onClick={onToggle}
      className={cn('h-7 gap-1 text-xs', isDefault && 'text-amber-500 hover:text-amber-600', className)}
    >
      <Star className={cn('h-3.5 w-3.5', isDefault && 'fill-current')} />
      {isDefault ? 'Default' : 'Set default'}
    </Button>
  );
}
