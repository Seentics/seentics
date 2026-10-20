'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { DashboardContentOverlay } from '@/components/content-demo/DashboardContentOverlay';
import { usePathSegment } from '@/lib/path-segment';
import { cn } from '@/lib/utils';
import { ClientModeProvider } from '@/features/client-mode/ClientMode';
import { FeatureGate } from '@/features/client-mode/FeatureGate';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  // usePathSegment, not useParams — see src/lib/path-segment.ts.
  const websiteId = usePathSegment(1) ?? ''; // /websites/:websiteId/...
  const pathname = usePathname();
  const isAiMode = pathname === `/websites/${websiteId}/ai`;

  // From md up the page runs edge to edge beside the sidebar, no line between: the sidebar is the
  // cards' colour against the page's grey in both themes.
  const framed = Boolean(websiteId) && !isAiMode;

  // Client mode (an agency's client user): the brand, the pages they may open, and which of
  // them they may only view. An account passes through unchanged.
  return (
    <ClientModeProvider websiteId={websiteId}>
    <div
      className={cn(
        'flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground supports-[height:100dvh]:h-[100dvh] md:flex-row',
      )}
    >
      {websiteId && !isAiMode && <Sidebar websiteId={websiteId} />}
      {/*
        flex flex-col + min-h-0: children can use flex-1 (e.g. session replay) and get real height.
        flex-1 + h-screen on <main> alone did not pass height into nested flex columns reliably.
      */}
      <div
        className={cn(
          'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          framed && 'app-frame',
        )}
      >
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"><FeatureGate>{children}</FeatureGate></main>
      </div>
      {websiteId && !isAiMode && <DashboardContentOverlay websiteId={websiteId} />}
    </div>
    </ClientModeProvider>
  );
}
