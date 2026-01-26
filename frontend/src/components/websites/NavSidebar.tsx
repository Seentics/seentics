'use client';

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
    Globe
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '../theme-toggle';
import { motion } from 'framer-motion';

export function NavSidebar({ websiteId }: { websiteId: string }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const links = [
        {
            title: 'Overview',
            href: `/websites/${websiteId}`,
            icon: LayoutDashboard,
            matchExact: true,
            description: 'Traffic & Summary'
        },
        {
            title: 'Websites',
            href: '/websites',
            icon: Globe,
            matchExact: true,
            description: 'All Properties'
        },
        {
            title: 'Automations',
            href: `/websites/${websiteId}/automations`,
            icon: Workflow,
            description: 'Workflows & Triggers'
        },
        {
            title: 'Funnels',
            href: `/websites/${websiteId}/funnels`,
            icon: Filter,
            description: 'Conversion Journeys'
        },
        {
            title: 'Billing',
            href: `/websites/${websiteId}/billing`,
            icon: CreditCard,
            description: 'Plan & Payment'
        },
        {
            title: 'Settings',
            href: `/websites/${websiteId}/settings`,
            icon: Settings,
            description: 'General Preferences'
        }
    ];

    return (
        <aside className="w-[280px] h-screen sticky top-0 border-r border-border bg-background/50 backdrop-blur-xl flex flex-col hidden lg:flex z-50">
            <div className="p-8 pb-4">
                <Link href="/" className="flex items-center gap-3 mb-10 group">
                    <Logo size="xl" showText={true} textClassName="text-xl font-bold text-foreground" />
                </Link>

                <div className="px-2 mb-4">
                    <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-60">Management</p>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
                {links.map((link) => {
                    const isActive = link.matchExact
                        ? pathname === link.href
                        : pathname.startsWith(link.href);

                    return (
                        <Link key={link.href} href={link.href} className="block relative">
                            <div className={cn(
                                "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative border border-transparent",
                                isActive
                                    ? "bg-primary/10 text-primary shadow-sm"
                                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )}>
                                <link.icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                                <div className="flex flex-col min-w-0">
                                    <span className={cn("font-bold text-[13px] leading-tight truncate", isActive ? "text-primary" : "text-foreground")}>{link.title}</span>
                                    <span className={cn("text-[9px] font-medium opacity-60 truncate", isActive ? "text-primary/80" : "text-muted-foreground")}>{link.description}</span>
                                </div>
                                {isActive && (
                                    <div className="absolute left-0 w-1 h-6 bg-primary rounded-full" />
                                )}
                            </div>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-6 mt-auto border-t border-border/50">
                <div className="flex justify-between items-center mb-6 px-2">
                    <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-60">Settings</p>
                    <ThemeToggle />
                </div>

                {user && (
                    <div className="p-4 rounded-2xl bg-accent/30 border border-border/40 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Avatar className="h-9 w-9 border border-border">
                                <AvatarImage src={user.avatar || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                    {user.name?.[0]?.toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold truncate text-foreground">{user.name || user.email?.split('@')[0]}</p>
                                <p className="text-[10px] text-muted-foreground font-medium truncate uppercase tracking-widest">
                                    Free Plan
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => logout()}
                            className="w-full h-8 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2 rounded-lg transition-all"
                        >
                            <LogOut size={12} />
                            Sign Out
                        </Button>
                    </div>
                )}
            </div>
        </aside>
    );
}
