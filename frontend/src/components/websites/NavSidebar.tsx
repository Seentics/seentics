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
    Globe,
    User,
    ChevronUp
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '../theme-toggle';
import { motion } from 'framer-motion';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

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
        <aside className="w-[280px] h-screen fixed top-0 left-0 border-r border-border bg-background/50 backdrop-blur-xl flex flex-col hidden lg:flex z-50">
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
                                "group flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 relative border border-transparent",
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

            <div className="p-4 mt-auto border-t border-border/40">
                {user && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-all text-left group">
                                <Avatar className="h-8 w-8 border border-border/40">
                                    <AvatarImage src={user.avatar || undefined} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs uppercase text-center flex items-center justify-center pt-0.5">
                                        {user.name?.[0] || user.email?.[0] || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{user.name || 'User'}</p>
                                    <p className="text-[10px] text-muted-foreground truncate font-medium">Account Settings</p>
                                </div>
                                <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground opacity-40 transition-opacity" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2 mb-2 rounded-lg border-border/40 shadow-xl" side="right" align="end" sideOffset={12}>
                             <div className="p-3">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">{user.name || 'Account'}</p>
                                <p className="text-[10px] text-muted-foreground opacity-60 truncate">{user.email}</p>
                            </div>
                            <Separator className="my-2 opacity-10" />
                            <div className="space-y-1">
                                <Link href={`/websites/${websiteId}/settings`}>
                                    <Button variant="ghost" size="sm" className="w-full justify-start h-9 text-xs font-bold gap-2 rounded-md">
                                        <Settings size={14} />
                                        Profile Settings
                                    </Button>
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => logout()}
                                    className="w-full justify-start h-9 text-xs font-bold gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-md"
                                >
                                    <LogOut size={14} />
                                    Sign Out
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </aside>
    );
}
