'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Filter,
    CreditCard,
    Settings,
    LogOut,
    Shield,
    Headset,
    Route,
} from 'lucide-react';
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export function DockNavigation({ websiteId }: { websiteId: string }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { closeMobileMenu } = useLayoutStore();
    const { subscription } = isEnterprise ? useSubscription() : { subscription: null };

    const featureLimitMap: Record<string, string> = {
        'Funnels': 'funnels',
    };

    const allLinks = [
        { title: 'Overview', href: `/websites/${websiteId}`, icon: LayoutDashboard, matchExact: true },
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
        <TooltipProvider delayDuration={200}>
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-2 py-1.5 bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl shadow-lg">
                {links.map((link) => {
                    const isActive = link.matchExact
                        ? pathname === link.href
                        : pathname.startsWith(link.href);
                    return (
                        <Tooltip key={link.title}>
                            <TooltipTrigger asChild>
                                <Link
                                    href={link.href}
                                    onClick={() => closeMobileMenu()}
                                    className={cn(
                                        'relative flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-200',
                                        isActive
                                            ? 'bg-primary/15 text-primary'
                                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                                    )}
                                >
                                    <link.icon size={18} />
                                    {isActive && (
                                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                                    )}
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                                {link.title}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}

                {/* Separator */}
                <div className="w-px h-6 bg-border/60 mx-0.5" />

                {/* User avatar */}
                {user && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="flex items-center justify-center h-10 w-10 rounded-xl hover:bg-accent/50 transition-colors">
                                <Avatar className="h-7 w-7 border border-border/60">
                                    <AvatarImage src={user.avatar || undefined} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[10px]">
                                        {user.name?.[0] || user.email?.[0] || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-0 mb-2 rounded-lg border-border/60 bg-card shadow-sm" side="top" align="end" sideOffset={8}>
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
            </div>
        </TooltipProvider>
    );
}
