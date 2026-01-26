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
    ChevronLeft,
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
        <aside className="w-[280px] h-screen sticky top-0 border-r bg-card/40 backdrop-blur-3xl flex flex-col hidden lg:flex shadow-2xl shadow-black/5 z-50">
            <div className="p-8 pb-4">
                <Link href="/" className="flex items-center gap-3 mb-10 group">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                        <span className="text-white font-black text-xl">S</span>
                    </div>
                    <div>
                        <span className="block text-lg font-black tracking-tight text-foreground leading-none">Seentics</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Platform</span>
                    </div>
                </Link>

                <div className="px-2 mb-4">
                    <p className="text-[10px] font-black tracking-[0.2em] text-muted-foreground/60 uppercase">Management</p>
                </div>
            </div>

            <nav className="flex-1 px-5 space-y-1 overflow-y-auto custom-scrollbar">
                {links.map((link) => {
                    const isActive = link.matchExact
                        ? pathname === link.href
                        : pathname.startsWith(link.href);

                    return (
                        <Link key={link.href} href={link.href}>
                            <div className={cn(
                                "group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 relative border border-transparent",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}>
                                <link.icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                                <div className="flex flex-col min-w-0">
                                    <span className={cn("font-bold text-[13px] leading-tight truncate", isActive ? "text-primary-foreground" : "text-foreground/90")}>{link.title}</span>
                                    <span className={cn("text-[9px] font-medium opacity-60 truncate", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>{link.description}</span>
                                </div>
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-active"
                                        className="absolute inset-0 bg-primary rounded-2xl -z-10"
                                        initial={false}
                                    />
                                )}
                            </div>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-6 mt-auto">
                <div className="flex justify-between items-center mb-6 px-2">
                    <p className="text-[10px] font-black tracking-[0.2em] text-muted-foreground/60 uppercase">Settings</p>
                    <ThemeToggle />
                </div>

                {user && (
                    <div className="relative group p-1 rounded-[2rem] bg-gradient-to-br from-border/50 to-transparent border border-border/40 overflow-hidden">
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative bg-card/50 backdrop-blur-md rounded-[1.8rem] p-4 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <Avatar className="h-10 w-10 border-2 border-background ring-2 ring-primary/10">
                                    <AvatarImage src={(user as any).user_metadata?.avatar_url} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                        {user.email?.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black truncate text-foreground">{user.email?.split('@')[0]}</p>
                                    <p className="text-[10px] text-primary font-black uppercase tracking-widest flex items-center gap-1">
                                        <div className="w-1 h-1 rounded-full bg-primary" />
                                        Free Tier
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => logout()}
                                className="w-full h-9 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 gap-2 rounded-xl transition-all border border-transparent hover:border-red-200/50"
                            >
                                <LogOut size={12} />
                                Sign Out
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
