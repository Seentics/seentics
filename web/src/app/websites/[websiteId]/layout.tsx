'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import TrackerScript from '@/components/tracker-script';
import { Sidebar } from '@/components/dashboard/Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-background text-foreground">
      <TrackerScript websiteId={websiteId} />
      {websiteId && <Sidebar websiteId={websiteId} />}
      {/*
        flex flex-col + min-h-0: children can use flex-1 (e.g. session replay) and get real height.
        flex-1 + h-screen on <main> alone did not pass height into nested flex columns reliably.
      */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
