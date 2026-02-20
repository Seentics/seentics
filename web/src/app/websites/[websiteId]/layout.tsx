'use client';

import React from 'react';
import TrackerScript from '@/components/tracker-script';
import { NavSidebar } from '@/components/websites/NavSidebar';
import { useParams, usePathname } from 'next/navigation';
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
  const pathname = usePathname();
  const websiteId = params?.websiteId as string;
  const { isSidebarOpen, isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useLayoutStore();

  const isHeatmapView = pathname.includes('/heatmaps/view');
  const isBuilderView = pathname.includes('/automations/builder');
  const isFullscreenView = isHeatmapView || isBuilderView;

  return (
    <div className={cn(
      "flex bg-background text-foreground overflow-x-hidden",
      isFullscreenView ? "h-screen overflow-hidden fixed inset-0" : "min-h-screen"
    )}>
      <TrackerScript />
      
      {/* Desktop Sidebar */}
      {!isFullscreenView && <NavSidebar websiteId={websiteId} />}

      {/* Mobile Header */}
      {!isFullscreenView && (
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
                 {/* Reuse NavSidebar contents for mobile */}
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
        !isFullscreenView && "pt-16 lg:pt-0", 
        (!isFullscreenView && isSidebarOpen) ? "lg:ml-[260px]" : (!isFullscreenView ? "lg:ml-[72px]" : "ml-0"),
        "px-0" 
      )}>
        {children}
      </main>
    </div>
  );
}