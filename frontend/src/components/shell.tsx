
'use client';
import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarFooter,
  SidebarRail,
  SidebarProvider,
} from '@/components/ui/sidebar';
import {
  Workflow,
  LayoutDashboard,
  Settings,
  BarChart,
  FileText,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Filter,
  Target,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { useSidebar } from './ui/sidebar';
import { SiteSelector } from './site-selector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ThemeToggle } from './theme-toggle';
import { PromotionBanner } from './promotion-banner';


const navItems = [
  { href: '/websites', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/analytics', label: 'Analytics', icon: BarChart },
];

function CollapseButton() {
  const { open, toggleSidebar } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="hidden md:flex"
      onClick={() => toggleSidebar()}
    >
      {open ? <PanelLeftClose /> : <PanelLeftOpen />}
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  );
}

function UserMenu() {
    const { user, logout } = useAuth();
    
    if (!user) return null;

    // Helper function to get OAuth provider
    const getOAuthProvider = () => {
        if (user.googleId) return 'Google';
        if (user.githubId) return 'GitHub';
        return null;
    };

    const oauthProvider = getOAuthProvider();

    // Debug: Log user data to console
    console.log('User data in UserMenu:', {
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        googleId: user.googleId,
        githubId: user.githubId,
        hasAvatar: !!user.avatar,
        avatarType: typeof user.avatar
    });

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-9 w-9">
                        <AvatarImage
                            src={user.avatar || undefined}
                            alt={user.name || 'User'}
                            data-ai-hint="person avatar"
                            onError={(e) => {
                                console.error('Avatar image failed to load:', e);
                                console.error('Failed avatar URL:', user.avatar);
                            }}
                            onLoad={() => {
                                console.log('Avatar image loaded successfully:', user.avatar);
                            }}
                        />
                        <AvatarFallback>
                            {user.name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" sideOffset={10}>
                <DropdownMenuLabel>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold truncate">{user.name ?? 'User'}</p>
                            <p className="text-xs text-muted-foreground font-normal truncate">{user.email}</p>
                            {/* Temporary debug info */}
                            <p className="text-xs text-red-500 font-normal truncate">
                                Avatar: {user.avatar || 'No avatar'}
                            </p>
                        </div>
                        {oauthProvider && (
                            <Badge variant="secondary" className="text-xs">
                                {oauthProvider}
                            </Badge>
                        )}
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log Out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const siteId = searchParams.get('siteId');

  const handleSiteChange = (newSiteId: string) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.set('siteId', newSiteId);
    router.push(`${pathname}?${newSearchParams.toString()}`);
  };

  const isNavItemActive = (href: string) => {
    const baseHref = href.split('?')[0];
    if (baseHref === '/websites') return pathname === '/websites';
    return pathname.startsWith(baseHref);
  };
  
  const contextualizeUrl = (url: string) => {
    if (siteId) {
      return `${url}?siteId=${siteId}`;
    }
    return url;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-secondary/30">
        <Sidebar collapsible="icon" variant="sidebar">
          <SidebarRail />
          <SidebarHeader>
            <Link href="/websites" className="flex items-center">
              <Logo size="lg" showText={true} textClassName="font-headline text-2xl font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden" />
            </Link>
          </SidebarHeader>
          <SidebarContent className="flex-grow">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavItemActive(item.href)}
                    tooltip={item.label}
                    disabled={!siteId}
                  >
                    <Link href={contextualizeUrl(item.href)}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
           <SidebarFooter>
             {/* Footer can be used for secondary actions if needed in the future */}
           </SidebarFooter>
        </Sidebar>
          <div className="flex flex-1 flex-col overflow-auto bg-background">
            <PromotionBanner />
            <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2 flex-1">
                 <SidebarTrigger className="md:hidden" />
                 <CollapseButton />
              </div>
              <div className="flex items-center gap-2 md:gap-4">
                {/* Automation Link */}
                <Link 
                  href="https://automation.seentics.com" 
                  target="_blank"
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all text-xs font-bold"
                >
                  <Workflow size={14} />
                  <span>Automation</span>
                </Link>

                <div className="h-6 w-[1px] bg-border hidden md:block" />

                <SiteSelector selectedSiteId={siteId} onSiteChange={handleSiteChange} />
                <ThemeToggle />
                <UserMenu />
              </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 lg:p-6">
              {children}
            </main>
          </div>
      </div>
    </SidebarProvider>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background animate-pulse" />}>
      <ShellContent>{children}</ShellContent>
    </Suspense>
  );
}
