'use client';

import React from 'react';
import TrackerScript from '@/components/tracker-script';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TrackerScript />
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}
