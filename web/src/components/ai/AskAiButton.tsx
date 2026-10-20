'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { buildAskAiHref } from '@/features/ai/ask-link';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface AskAiButtonProps {
  websiteId: string;
  /** Typed into the composer, not sent — the visitor decides whether to ask it. */
  question: string;
  /** Short label for where the question came from, shown beside the composer. */
  context?: string;
  /** `sm` in a panel header, `md` in a page header beside the AI Mode pill. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * "Ask AI about this": opens AI mode with a question about the panel it sits on.
 *
 * A link rather than a button so it can be opened in a new tab, and icon-only so it fits
 * a panel header that already carries a title and a tab strip. Callers leave it out on
 * embeds and the demo, where there is no assistant to open.
 */
export function AskAiButton({ websiteId, question, context, size = 'sm', className }: AskAiButtonProps) {
  const md = size === 'md';
  const label = useT().ai.ask.button;
  return (
    <Link
      href={buildAskAiHref(websiteId, question, context)}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors',
        'hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:text-primary focus-visible:outline-none',
        md ? 'h-9 w-9' : 'h-7 w-7',
        className,
      )}
    >
      <Sparkles className={md ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
    </Link>
  );
}
