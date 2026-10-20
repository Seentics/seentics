'use client';

import type { ReactNode } from 'react';
import { AgencySidebar } from '@/components/agency-workspace/AgencySidebar';
import { AgencyGate } from '@/components/agency-workspace/AgencyGate';

/** The agency workspace: its own sidebar, and the dashboard's framed page beside it. */
export default function AgencyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground supports-[height:100dvh]:h-[100dvh] md:flex-row md:bg-sidebar">
      <AgencySidebar />
      <div className="app-frame relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <AgencyGate>{children}</AgencyGate>
        </main>
      </div>
    </div>
  );
}
