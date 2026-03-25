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
    <div className="min-h-screen bg-background text-foreground flex">
      <TrackerScript />
      {websiteId && <Sidebar websiteId={websiteId} />}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
