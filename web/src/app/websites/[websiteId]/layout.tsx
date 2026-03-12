'use client';

import React from 'react';
import TrackerScript from '@/components/tracker-script';
import { NavSidebar } from '@/components/websites/NavSidebar';
import { DockNavigation } from '@/components/websites/DockNavigation';
import { HeaderNavigation } from '@/components/websites/HeaderNavigation';
import { useParams, usePathname } from 'next/navigation';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

function DemoBanner() {
  return (
    <div className="bg-gradient-to-r from-violet-600/90 to-primary/90 text-white text-center py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2 relative z-[60]">
      <Sparkles className="h-3 w-3 opacity-70" />
      <span className="opacity-90">Live demo with sample data</span>
      <Link href="/register" className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold transition-colors">
        Create free account <ArrowRight className="h-2.5 w-2.5" />
      </Link>
    </div>
  );
}

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const params = useParams();
  const pathname = usePathname();
  const websiteId = params?.websiteId as string;
  const isDemoMode = websiteId === 'demo';
  const { isSidebarOpen, isMobileMenuOpen, toggleMobileMenu, closeMobileMenu, layoutMode } = useLayoutStore();

  const isHeatmapView = pathname.includes('/heatmaps/view');
  const isBuilderView = pathname.includes('/automations/builder');
  const isFullscreenView = isHeatmapView || isBuilderView;

  const isSidebar = layoutMode === 'sidebar';
  const isDock = layoutMode === 'dock';
  const isHeader = layoutMode === 'header';
  const isFloatingHeader = layoutMode === 'floating-header';

  return (
    <>
      {isDemoMode && <DemoBanner />}
    <div className={cn(
      "flex bg-background text-foreground overflow-x-hidden",
      isFullscreenView ? "h-screen overflow-hidden fixed inset-0" : "min-h-screen"
    )}>
      <TrackerScript />

      {/* Sidebar Mode - Desktop */}
      {!isFullscreenView && isSidebar && <NavSidebar websiteId={websiteId} />}

      {/* Dock Mode */}
      {!isFullscreenView && isDock && <DockNavigation websiteId={websiteId} />}

      {/* Header / Floating Header Mode */}
      {!isFullscreenView && (isHeader || isFloatingHeader) && (
        <HeaderNavigation websiteId={websiteId} floating={isFloatingHeader} />
      )}

      {/* Mobile Header - sidebar mode only */}
      {!isFullscreenView && isSidebar && (
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b border-border/40 z-40 px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="lg" showText={true} textClassName="text-lg font-bold" />
          </Link>

          <Sheet open={isMobileMenuOpen} onOpenChange={toggleMobileMenu}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[260px] border-r-0">
              <div className="h-full flex flex-col">
                 <div className="flex-1 overflow-y-auto">
                    <NavSidebar websiteId={websiteId} mobile={true} />
                 </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      <main className={cn(
        "flex-1 w-full relative min-w-0 transition-all duration-300 ease-in-out bg-background text-foreground",
        isFullscreenView && "overflow-hidden h-full",
        // Sidebar mode
        (!isFullscreenView && isSidebar) && "pt-16 lg:pt-0",
        (!isFullscreenView && isSidebar && isSidebarOpen) ? "lg:ml-[260px]" : ((!isFullscreenView && isSidebar) ? "lg:ml-[72px]" : ""),
        // Dock mode - bottom padding for dock
        (!isFullscreenView && isDock) && "pb-20",
        // Header mode - top padding
        (!isFullscreenView && isHeader) && "pt-14",
        // Floating header mode - top padding with spacing
        (!isFullscreenView && isFloatingHeader) && "pt-[72px]",
        !isFullscreenView && "px-0"
      )}>
        {children}
      </main>
    </div>
    </>
  );
}