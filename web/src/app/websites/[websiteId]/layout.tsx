'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { DashboardContentOverlay } from '@/components/content-demo/DashboardContentOverlay';
import { usePathSegment } from '@/lib/path-segment';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  // usePathSegment, not useParams — see src/lib/path-segment.ts.
  const websiteId = usePathSegment(1) ?? ''; // /websites/:websiteId/...
  const pathname = usePathname();
  const isAiMode = pathname === `/websites/${websiteId}/ai`;

  // From md up the page sits in a rounded frame inset from the window, the sidebar on the
  // chrome around it, as in Linear's app. Phones stay edge to edge.
  const framed = Boolean(websiteId) && !isAiMode;

  return (
    <div
      className={cn(
        'flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground supports-[height:100dvh]:h-[100dvh] md:flex-row',
        framed && 'md:bg-sidebar',
      )}
    >
      {websiteId && !isAiMode && <Sidebar websiteId={websiteId} />}
      {/*
        flex flex-col + min-h-0: children can use flex-1 (e.g. session replay) and get real height.
        flex-1 + h-screen on <main> alone did not pass height into nested flex columns reliably.
      */}
      <main
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto',
          framed && 'bg-background md:my-2 md:mr-2 md:rounded-xl md:border md:border-border md:shadow-[var(--panel-edge)]',
        )}
      >
        {children}
      </main>
      {websiteId && !isAiMode && <DashboardContentOverlay websiteId={websiteId} />}
    </div>
  );
}
