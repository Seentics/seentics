'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Workflow,
    Filter,
    CreditCard,
    Settings,
    LogOut,
    Shield,
    Headset,
    MousePointer2,
    Video,
    Route,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/stores/useAuthStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { isEnterprise } from '@/lib/features';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

export function HeaderNavigation({ websiteId, floating = false }: { websiteId: string; floating?: boolean }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { closeMobileMenu } = useLayoutStore();
    const { subscription } = isEnterprise ? useSubscription() : { subscription: null };

    const featureLimitMap: Record<string, string> = {
        'Heatmaps': 'heatmaps',
        'Session Replay': 'replays',
        'Automations': 'workflows',
        'Funnels': 'funnels',
    };

    const allLinks = [
        { title: 'Overview', href: `/websites/${websiteId}`, icon: LayoutDashboard, matchExact: true },
        { title: 'Heatmaps', href: `/websites/${websiteId}/heatmaps`, icon: MousePointer2 },
        { title: 'Replays', href: `/websites/${websiteId}/replays`, icon: Video },
        { title: 'Automations', href: `/websites/${websiteId}/automations`, icon: Workflow },
        { title: 'Funnels', href: `/websites/${websiteId}/funnels`, icon: Filter },
        { title: 'Paths', href: `/websites/${websiteId}/paths`, icon: Route, enterpriseOnly: true },
        { title: 'Billing', href: `/websites/${websiteId}/billing`, icon: CreditCard, enterpriseOnly: true },
        { title: 'Privacy', href: `/websites/${websiteId}/privacy`, icon: Shield, enterpriseOnly: true },
        { title: 'Settings', href: `/websites/${websiteId}/settings`, icon: Settings },
        { title: 'Support', href: `/websites/${websiteId}/support`, icon: Headset, enterpriseOnly: true },
    ];

    const links = allLinks.filter(link => {
        if (!isEnterprise && link.enterpriseOnly) return false;
        if (isEnterprise && subscription) {
            const usageKey = featureLimitMap[link.title];
            if (usageKey) {
                const usage = subscription.usage[usageKey as keyof typeof subscription.usage];
                if (usage && usage.limit === 0) return false;
            }
        }
        return true;
    });

    return (
        <header
            className={cn(
                'fixed z-50 flex items-center justify-between transition-all duration-300',
                floating
                    ? 'top-3 left-4 right-4 h-12 bg-card/80 backdrop-blur-xl border border-border/60 rounded-full shadow-lg px-4'
                    : 'top-0 left-0 right-0 h-14 bg-card border-b border-border/60 px-6'
            )}
        >
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
                <Logo size="lg" showText={!floating} textClassName="text-lg font-bold tracking-tight text-foreground" />
                {websiteId === 'demo' && (
                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-500 border border-indigo-500/20 leading-none">
                        Demo
                    </span>
                )}
            </Link>

            {/* Navigation items */}
            <nav className="flex items-center gap-0.5 overflow-x-auto mx-4">
                {links.map((link) => {
                    const isActive = link.matchExact
                        ? pathname === link.href
                        : pathname.startsWith(link.href);
                    return (
                        <Link
                            key={link.title}
                            href={link.href}
                            onClick={() => closeMobileMenu()}
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200',
                                isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                floating ? 'px-2 py-1' : 'px-2.5 py-1.5'
                            )}
                        >
                            <link.icon size={14} />
                            <span className="hidden lg:inline">{link.title}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* User avatar */}
            {user && (
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
                            <Avatar className={cn("border border-border/60", floating ? "h-7 w-7" : "h-8 w-8")}>
                                <AvatarImage src={user.avatar || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                                    {user.name?.[0] || user.email?.[0] || 'U'}
                                </AvatarFallback>
                            </Avatar>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-0 mt-2 rounded-lg border-border/60 bg-card shadow-sm" side="bottom" align="end" sideOffset={8}>
                        <div className="p-3 border-b border-border/40">
                            <p className="text-sm font-medium text-foreground">{user.name || 'Account'}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
                        </div>
                        <div className="p-1.5">
                            <Link href={`/websites/${websiteId}/settings`}>
                                <Button variant="ghost" size="sm" className="w-full justify-start h-9 text-xs font-medium gap-2.5 rounded-md hover:bg-accent">
                                    <Settings size={14} className="text-muted-foreground" />
                                    Settings
                                </Button>
                            </Link>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={logout}
                                className="w-full justify-start h-9 text-xs font-medium gap-2.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-md"
                            >
                                <LogOut size={14} />
                                Sign Out
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </header>
    );
}
