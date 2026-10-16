'use client';

import { MessageSquare, Plus, Sparkles } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { MOCK_FRAME } from './MockSidebar';
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
  // The AI page's shape (app/websites/[websiteId]/ai): conversations on the chrome, the
  // chat in the dashboard's rounded frame.
  return (
    <div className="flex h-full w-full bg-sidebar text-foreground">
      <aside className="flex w-56 shrink-0 flex-col">
        <div className="flex items-center gap-2 px-4 py-3.5">
          <Logo size="sm" className="shrink-0" />
          <span className="text-sm font-semibold text-foreground">Seentics AI</span>
        </div>
        <div className="px-3 pb-2">
          <div className="flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-[13px] font-medium text-foreground">
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
                (i === 0 ? 'bg-accent text-foreground' : 'text-foreground/60')
              }
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t.title}</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className={`flex min-w-0 flex-1 flex-col ${MOCK_FRAME}`}>
        <div className="flex shrink-0 items-center justify-end gap-3 border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> Default</span>
          <span>Dashboard</span>
        </div>
        <div className="flex-1 overflow-hidden px-6 py-6">
          <div className="mx-auto w-full max-w-2xl">
            <ConversationView messages={AI_DEMO_MESSAGES} />
          </div>
        </div>
        <div className="px-6 pb-5">
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex h-[64px] items-start rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">
              Ask about traffic, funnels, errors… or ask me to set something up
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
