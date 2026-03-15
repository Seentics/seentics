'use client';

import React from 'react';
import TrackerScript from '@/components/tracker-script';
import { NavSidebar } from '@/components/websites/NavSidebar';
import { DockNavigation } from '@/components/websites/DockNavigation';
import { HeaderNavigation } from '@/components/websites/HeaderNavigation';
import { useParams } from 'next/navigation';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const { isSidebarOpen, isMobileMenuOpen, toggleMobileMenu, closeMobileMenu, layoutMode } = useLayoutStore();

  const isSidebar = layoutMode === 'sidebar';
  const isDock = layoutMode === 'dock';
  const isHeader = layoutMode === 'header';
  const isFloatingHeader = layoutMode === 'floating-header';

  return (
    <div className="flex bg-background text-foreground overflow-x-hidden min-h-screen">
      <TrackerScript />

      {/* Sidebar Mode - Desktop */}
      {isSidebar && <NavSidebar websiteId={websiteId} />}

      {/* Dock Mode */}
      {isDock && <DockNavigation websiteId={websiteId} />}

      {/* Header / Floating Header Mode */}
      {(isHeader || isFloatingHeader) && (
        <HeaderNavigation websiteId={websiteId} floating={isFloatingHeader} />
      )}

      {/* Mobile Header - sidebar mode only */}
      {isSidebar && (
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
        "flex-1 w-full relative min-w-0 transition-all duration-300 ease-in-out bg-background text-foreground px-0",
        // Sidebar mode
        isSidebar && "pt-16 lg:pt-0",
        (isSidebar && isSidebarOpen) ? "lg:ml-[260px]" : (isSidebar ? "lg:ml-[72px]" : ""),
        // Dock mode - bottom padding for dock
        isDock && "pb-20",
        // Header mode - top padding
        isHeader && "pt-14",
        // Floating header mode - top padding with spacing
        isFloatingHeader && "pt-[72px]",
      )}>
        {children}
      </main>
    </div>
  );
}