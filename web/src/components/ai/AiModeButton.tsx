import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AiModeButtonProps {
  websiteId: string;
  /** Matches the surrounding control row: `sm` beside filters, `md` in a page header. */
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

/**
 * The link into AI mode.
 *
 * One component for all three placements — the sidebar, the overview control row and the
 * page header — because they had drifted into three different treatments of the same
 * link: a bordered card button, a muted pill, and a tinted one. A single tinted pill
 * reads as a mode switch rather than another button in the row.
 */
export function AiModeButton({ websiteId, size = 'sm', label = 'AI Mode', className }: AiModeButtonProps) {
  const md = size === 'md';
  return (
    <Link
      href={`/websites/${websiteId}/ai`}
      title="Open AI Mode"
      className={cn(
        'flex shrink-0 items-center rounded-lg bg-primary/10 font-semibold text-primary transition-colors hover:bg-primary/15',
        md ? 'h-9 gap-2 px-3 text-sm' : 'h-8 gap-1.5 px-2.5 text-xs',
        className,
      )}
    >
      <Sparkles className={cn('shrink-0', md ? 'h-4 w-4' : 'h-3.5 w-3.5')} />
      <span>{label}</span>
    </Link>
  );
}
