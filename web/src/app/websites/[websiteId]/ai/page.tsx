'use client';

import { useParams } from 'next/navigation';
import { AssistantChat } from '@/components/ai/AssistantChat';
import { useAuth } from '@/stores/useAuthStore';

/**
 * Route composition only.
 *
 * `showUsage` reveals per-message token cost, which is an operator concern rather than a
 * customer one — a figure that means something to whoever pays the model bill and
 * nothing to someone asking about their traffic.
 */
export default function AIModePage() {
  const params = useParams();
  const { user } = useAuth();
  const websiteId = params?.websiteId as string;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <AssistantChat
        websiteId={websiteId}
        showUsage={Boolean((user as { isAdmin?: boolean } | null)?.isAdmin)}
      />
    </div>
  );
}
