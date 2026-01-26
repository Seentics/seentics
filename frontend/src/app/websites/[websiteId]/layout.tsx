'use client';

import React from 'react';
import TrackerScript from '@/components/tracker-script';
import { NavSidebar } from '@/components/websites/NavSidebar';
import { useParams } from 'next/navigation';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  return (
    <div className="flex min-h-screen bg-background">
      <TrackerScript />
      <NavSidebar websiteId={websiteId} />
      <main className="flex-1 w-full relative min-w-0">
        {children}
      </main>
    </div>
  );
}