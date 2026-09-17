'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { DashboardContentOverlay } from '@/components/content-demo/DashboardContentOverlay';
import { usePathSegment } from '@/lib/path-segment';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  // usePathSegment, not useParams — see src/lib/path-segment.ts.
  const websiteId = usePathSegment(1) ?? ''; // /websites/:websiteId/...
  const pathname = usePathname();
  const isAiMode = pathname === `/websites/${websiteId}/ai`;

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-background text-foreground">
      {websiteId && !isAiMode && <Sidebar websiteId={websiteId} />}
      {/*
        flex flex-col + min-h-0: children can use flex-1 (e.g. session replay) and get real height.
        flex-1 + h-screen on <main> alone did not pass height into nested flex columns reliably.
      */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>
      {websiteId && !isAiMode && <DashboardContentOverlay websiteId={websiteId} />}
    </div>
  );
}
