import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DisplayBlock } from '@/features/ai/types';

type Props = { block: Extract<DisplayBlock, { kind: 'links' }>; className?: string };

/**
 * Results worth clicking through to — sessions, automations, errors.
 *
 * Hrefs are built by the tool from ids, never from model output, so there is nothing
 * here a reply could turn into a link somewhere else.
 */
export function LinksBlock({ block, className }: Props) {
  if (!block.items.length) return null;
  return (
    <div className={cn('divide-y divide-border overflow-hidden rounded-xl border border-border', className)}>
      {block.items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-2 bg-card px-3 py-2 transition-colors hover:bg-muted/50"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
            {item.sublabel && (
              <p className="truncate text-xs text-muted-foreground">{item.sublabel}</p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}
