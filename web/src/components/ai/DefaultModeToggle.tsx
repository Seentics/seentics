'use client';

import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
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
  const t = useT().ai.defaultToggle;
  if (!ready) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-pressed={isDefault}
      title={isDefault ? t.isDefaultTitle : t.setDefaultTitle}
      onClick={onToggle}
      className={cn('h-7 gap-1 text-xs', isDefault && 'text-amber-500 hover:text-amber-600', className)}
    >
      <Star className={cn('h-3.5 w-3.5', isDefault && 'fill-current')} />
      {isDefault ? t.isDefault : t.setDefault}
    </Button>
  );
}
