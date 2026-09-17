'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useCallback, useState } from 'react';

import { AiSidebar } from '@/components/ai/AiSidebar';
import { AssistantChat } from '@/components/ai/AssistantChat';
import { DefaultModeToggle } from '@/components/ai/DefaultModeToggle';
import { useConversationList } from '@/features/ai/queries';
import { useDefaultMode } from '@/features/ai/default-mode';
import { useAuth } from '@/stores/useAuthStore';

/**
 * Route composition only.
 *
 * The thread being read lives here rather than in either panel, because both need it:
 * the sidebar highlights it and the chat loads it. `resetKey` is how "New chat" clears
 * the conversation without remounting `AssistantChat`, which would drop focus from the
 * composer mid-typing.
 *
 * `showUsage` reveals per-message token cost — a figure that means something to whoever
 * pays the model bill and nothing to someone asking about their traffic.
 */
export default function AIModePage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const { user } = useAuth();
  const websiteId = params?.websiteId as string;

  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const [resetKey, setResetKey] = useState(0);

  const list = useConversationList(websiteId);
  const defaultMode = useDefaultMode(websiteId);

  const newChat = useCallback(() => {
    setOpenId(undefined);
    setResetKey((n) => n + 1);
  }, []);

  return (
    <div className="flex h-full min-h-0 bg-background">
      <AiSidebar
        websiteId={websiteId}
        conversations={list.data ?? []}
        isLoading={list.isLoading}
        activeId={openId}
        onSelect={setOpenId}
        onNewChat={newChat}
        className="hidden md:flex"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AssistantChat
          // Remount on thread change so the chat starts from that conversation rather
          // than merging it into whatever is already on screen.
          key={openId ?? `new-${resetKey}`}
          websiteId={websiteId}
          conversationId={openId}
          resetKey={resetKey}
          onConversationChange={setOpenId}
          showUsage={Boolean((user as { isAdmin?: boolean } | null)?.isAdmin)}
          headerActions={
            <DefaultModeToggle
              isDefault={defaultMode.isDefaultAi}
              ready={defaultMode.ready}
              onToggle={defaultMode.toggle}
            />
          }
        />
      </div>
    </div>
  );
}
