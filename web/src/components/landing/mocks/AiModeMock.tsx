'use client';

import { MessageSquare, Plus, Sparkles } from 'lucide-react';
import { ConversationView } from '@/components/ai/ConversationView';
import { AI_DEMO_MESSAGES, AI_DEMO_THREADS } from '@/features/ai/demo-data';

/**
 * The assistant, as the landing page shows it.
 *
 * Built from the real `ConversationView` fed fixtures, not a redrawn lookalike — the
 * message bubbles, the metric tiles and the proposal card in this shot are the same
 * components the product renders, so the marketing screen cannot drift from the product
 * without the build noticing.
 *
 * The sidebar and composer are drawn here rather than mounted: `AiSidebar` fetches its
 * threads and `ChatComposer` is an input someone could type into, neither of which
 * belongs in a static shot. They carry no logic, so there is nothing to drift.
 */
export function AiModeMock() {
  return (
    <div className="flex h-full w-full bg-background">
      <aside className="flex w-52 shrink-0 flex-col bg-muted/40 dark:bg-muted/20">
        <div className="flex items-center gap-2 px-3 py-3">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Sparkles className="h-3 w-3" />
          </span>
          <span className="text-sm font-semibold text-foreground">Seentics AI</span>
        </div>
        <div className="px-3 pb-2">
          <div className="flex h-8 items-center gap-2 rounded-lg bg-background/70 px-3 text-[13px] font-medium text-foreground">
            <Plus className="h-3.5 w-3.5" />
            New chat
          </div>
        </div>
        <ul className="space-y-0.5 px-2">
          {AI_DEMO_THREADS.map((t, i) => (
            <li
              key={t.id}
              className={
                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] ' +
                (i === 0 ? 'bg-background text-foreground' : 'text-muted-foreground')
              }
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t.title}</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-hidden px-6 py-6">
          <div className="mx-auto w-full max-w-2xl">
            <ConversationView messages={AI_DEMO_MESSAGES} />
          </div>
        </div>
        <div className="px-6 pb-6">
          <div className="mx-auto w-full max-w-2xl">
            <div className="flex h-[60px] items-start rounded-xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.6)]">
              Ask about traffic, funnels, errors… or ask me to set something up
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
