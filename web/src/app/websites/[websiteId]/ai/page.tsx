'use client';

import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AssistantChat } from '@/components/ai/AssistantChat';
import { DefaultModeToggle } from '@/components/ai/DefaultModeToggle';
import { useDefaultMode } from '@/features/ai/default-mode';
import { useAuth } from '@/stores/useAuthStore';

/**
 * Route composition only.
 *
 * `showUsage` reveals per-message token cost, which means something to whoever pays the
 * model bill and nothing to someone asking about their traffic.
 */
export default function AIModePage() {
  const params = useParams();
  const { user } = useAuth();
  const websiteId = params?.websiteId as string;
  const defaultMode = useDefaultMode(websiteId);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <AssistantChat
        websiteId={websiteId}
        showUsage={Boolean((user as { isAdmin?: boolean } | null)?.isAdmin)}
        headerActions={
          <>
            {/*
              `?dashboard=1` opts out of the redirect for this visit. Without it, a
              website defaulting to AI mode would bounce straight back and there would be
              no way out of the mode you just set as default.
            */}
            <Button asChild size="sm" variant="ghost" className="h-7 gap-1 text-xs">
              <Link href={`/websites/${websiteId}?dashboard=1`}>
                <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
              </Link>
            </Button>
            <DefaultModeToggle
              isDefault={defaultMode.isDefaultAi}
              ready={defaultMode.ready}
              onToggle={defaultMode.toggle}
            />
          </>
        }
      />
    </div>
  );
}
