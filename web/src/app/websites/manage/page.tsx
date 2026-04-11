'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { websiteWorkspaceShellClass } from '@/lib/website-shell';
import { WebsitesSettingsPanel } from '@/components/settings/WebsitesSettingsPanel';

/** Full-page entry to manage all websites. Prefer Settings → Websites from any dashboard. */
export default function WebsitesManagePage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/30">
        <div className={cn(websiteWorkspaceShellClass, 'flex flex-wrap items-center justify-between gap-4 py-4')}>
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <Logo size="sm" />
              <span className="text-lg font-bold tracking-tight text-foreground">Seentics</span>
            </Link>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <h1 className="truncate text-lg font-semibold text-foreground">Websites</h1>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  router.push('/signin');
                }}
                className="gap-1.5 text-muted-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className={cn(websiteWorkspaceShellClass, 'pb-12 pt-6')}>
        <WebsitesSettingsPanel redirectWhenEmpty />
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="gap-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
