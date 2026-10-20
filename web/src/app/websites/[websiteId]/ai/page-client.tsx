'use client';

import { usePathSegment } from '@/lib/path-segment';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { LayoutDashboard } from 'lucide-react';

import { AiSidebar } from '@/components/ai/AiSidebar';
import { AssistantChat } from '@/components/ai/AssistantChat';
import { DefaultModeToggle } from '@/components/ai/DefaultModeToggle';
import { useConversationList } from '@/features/ai/queries';
import { useDefaultMode } from '@/features/ai/default-mode';
import { readAskParams, type AskParams } from '@/features/ai/ask-link';
import { useAuth } from '@/stores/useAuthStore';
import { useT } from '@/lib/i18n';

/**
 * Route composition only.
 *
 * The thread being read lives here rather than in either panel, because both need it:
 * the sidebar highlights it and the chat loads it. Two pieces of state, deliberately:
 * `activeId` follows the chat (a first reply creates a thread the sidebar should
 * highlight), while `selection` changes only when someone picks a thread or starts a new
 * one. The chat remounts on `selection` alone — remounting when a first reply assigns an
 * id would throw away its rendered panels and reload the thread as plain text.
 *
 * `?q=` (and `?ctx=`) come from an "Ask AI about this" link: they start a new chat with
 * the question typed in but not sent, then leave the address so a reload does not
 * prefill it again.
 *
 * `showUsage` reveals per-message token cost — a figure that means something to whoever
 * pays the model bill and nothing to someone asking about their traffic.
 */
export default function AIModePage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const { user } = useAuth();
  const t = useT().ai.page;
  const websiteId = params?.websiteId as string;

  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [selection, setSelection] = useState<{ id?: string; key: number }>({ key: 0 });

  const [prefill, setPrefill] = useState<AskParams | null>(null);

  const list = useConversationList(websiteId);
  const defaultMode = useDefaultMode(websiteId);

  const select = useCallback((id: string) => {
    // Already on screen: remounting would only reload it without its panels.
    if (id === activeId) return;
    setPrefill(null);
    setActiveId(id);
    setSelection((s) => ({ id, key: s.key + 1 }));
  }, [activeId]);

  const newChat = useCallback(() => {
    setPrefill(null);
    setActiveId(undefined);
    setSelection((s) => ({ key: s.key + 1 }));
  }, []);

  const onAsk = useCallback((ask: AskParams) => {
    setPrefill(ask);
    setActiveId(undefined);
    setSelection((s) => ({ key: s.key + 1 }));
    // History, not the router: only the query changes, and a router navigation on these
    // statically exported shells can turn into a full reload that would drop the prefill.
    // Next keeps `useSearchParams` in step with `history.replaceState`.
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }, []);

  return (
    // The dashboard's shape: the conversations on the chrome, the chat in a rounded frame.
    <div className="flex h-full min-h-0 bg-background md:bg-sidebar">
      <AiSidebar
        websiteId={websiteId}
        conversations={list.data ?? []}
        isLoading={list.isLoading}
        activeId={activeId}
        onSelect={select}
        onNewChat={newChat}
        className="hidden md:flex"
      />

      {/* `useSearchParams` needs a Suspense boundary to prerender this page statically. */}
      <Suspense fallback={null}>
        <AskParamsReader onAsk={onAsk} />
      </Suspense>

      <div className="app-frame relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AssistantChat
          // Remount on an explicit pick or "New" so the chat starts from that conversation
          // rather than merging it into whatever is already on screen — and so a reply
          // still in flight for the old thread has nowhere to land.
          key={selection.key}
          websiteId={websiteId}
          conversationId={selection.id}
          onConversationChange={setActiveId}
          onNewChat={newChat}
          showUsage={Boolean((user as { isAdmin?: boolean } | null)?.isAdmin)}
          initialPrompt={prefill?.q}
          promptContext={prefill?.ctx}
          recommendationId={prefill?.rec ?? null}
          headerActions={
            <>
              <DefaultModeToggle
                isDefault={defaultMode.isDefaultAi}
                ready={defaultMode.ready}
                onToggle={defaultMode.toggle}
              />
              {/* The sidebar's way back is hidden on narrow screens; this one is always there.
                  `?dashboard=1` so a website that opens in AI mode does not bounce straight back. */}
              {websiteId && (
                <Link
                  href={`/websites/${websiteId}?dashboard=1`}
                  className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  {t.dashboard}
                </Link>
              )}
            </>
          }
        />
      </div>
    </div>
  );
}

/** Hands a `?q=` prefill to the page, once per distinct question. */
function AskParamsReader({ onAsk }: { onAsk: (ask: AskParams) => void }) {
  const searchParams = useSearchParams();
  const ask = readAskParams(searchParams);
  const q = ask?.q;
  const ctx = ask?.ctx;
  const rec = ask?.rec;
  useEffect(() => {
    if (q) onAsk({ q, ctx: ctx ?? null, rec: rec ?? null });
  }, [q, ctx, rec, onAsk]);
  return null;
}
