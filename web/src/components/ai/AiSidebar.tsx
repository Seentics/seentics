'use client';

import Link from 'next/link';
import { ChevronLeft, MessageSquare, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/logo';
import type { ConversationSummary } from '@/features/ai/types';

export interface AiSidebarProps {
  websiteId: string;
  conversations: ConversationSummary[];
  activeId?: string | null;
  onSelect: (conversationId: string) => void;
  onNewChat: () => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * The thread list beside the assistant.
 *
 * Separated from the page by contrast rather than a border — a rule down the middle of a
 * two-panel screen reads as a seam, and the surface change already says where one panel
 * ends. `bg-muted/40` is enough in both themes because it moves with the palette rather
 * than being a fixed grey.
 *
 * Presentational: it takes the list and two callbacks. The page owns which thread is
 * open, so the sidebar works the same whether that lives in state or in the URL.
 */
export function AiSidebar({
  websiteId, conversations, activeId, onSelect, onNewChat, isLoading, className,
}: AiSidebarProps) {
  return (
    <aside
      className={cn(
        'flex w-64 shrink-0 flex-col bg-muted/40 dark:bg-muted/20',
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
        <Link href={`/websites/${websiteId}?dashboard=1`} className="flex min-w-0 items-center gap-2">
          <Logo className="h-5 w-5 shrink-0" />
          <span className="truncate text-sm font-semibold text-foreground">Seentics AI</span>
        </Link>
        <Link
          href={`/websites/${websiteId}?dashboard=1`}
          title="Back to dashboard"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-9 w-full items-center gap-2 rounded-lg bg-background/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-background"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <div className="space-y-1 px-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-background/50" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Your conversations will appear here.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  title={c.title}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors',
                    c.id === activeId
                      ? 'bg-background text-foreground'
                      : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{c.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
