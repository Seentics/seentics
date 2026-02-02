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
    Shield,
    Globe,
    User,
    ChevronUp,
    Headset,
    Lock,
    Mail,
    MessageSquare,
    FileText
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
            title: 'Privacy',
            href: `/websites/${websiteId}/privacy`,
            icon: Shield,
            description: 'GDPR & Privacy'
        },
        {
            title: 'Settings',
            href: `/websites/${websiteId}/settings`,
            icon: Settings,
            description: 'General Preferences'
        },
        {
            title: 'Support',
            href: `/websites/${websiteId}/support`,
            icon: Headset,
            description: 'Help & Contact'
        },
        {
            title: 'Emails',
            href: '#',
            icon: Mail,
            description: 'Email Marketing',
            badge: 'Upcoming',
            separator: true
        },
        {
            title: 'Support Desk',
            href: '#',
            icon: MessageSquare,
            description: 'Help Desk',
            badge: 'Upcoming'
        },
        {
            title: 'Forms',
            href: '#',
            icon: FileText,
            description: 'Lead Gen Forms',
            badge: 'Upcoming'
        }
    ];

    return (
        <aside className="w-[280px] h-screen fixed top-0 left-0 bg-sidebar border-r border-sidebar-border backdrop-blur-xl flex flex-col hidden lg:flex z-50">
            <div className="p-8 pb-4">
                <Link href="/" className="flex items-center gap-3 mb-6 group">
                    <Logo size="xl" showText={true} textClassName="text-xl font-bold text-sidebar-foreground" />
                </Link>
            </div>

            <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
                {links.map((link) => {
                    const isActive = link.matchExact
                        ? pathname === link.href
                        : pathname.startsWith(link.href);

                    const isDemo = websiteId === 'demo';
                    const isDisabled = isDemo && link.title !== 'Overview';

                    return (
                        <div key={link.href}>
                             {/* @ts-ignore */}
                            {link.separator && (
                                <div className="px-4 py-2">
                                    <div className="h-px bg-sidebar-border" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50 mt-2 block pl-2">Upcoming</span>
                                </div>
                            )}
                            <Link 
                                href={isDisabled ? '#' : link.href} 
                                className={cn("block relative", isDisabled && "pointer-events-none")}
                                aria-disabled={isDisabled}
                            >
                            <div className={cn(
                                "group flex items-center gap-3 px-4 py-3 rounded transition-all duration-300 relative border border-transparent",
                                isActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                isDisabled && "opacity-50"
                            )}>
                                <div className="relative">
                                    <link.icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-primary" : "text-sidebar-foreground group-hover:text-primary")} />
                                    {isDisabled && (
                                        <div className="absolute -top-1 -right-1 bg-sidebar rounded-full p-0.5 border border-sidebar-border shadow-sm">
                                            <Lock className="h-2 w-2 text-sidebar-foreground" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className={cn("font-bold text-[13px] leading-tight truncate", isActive ? "text-sidebar-foreground" : "text-sidebar-foreground")}>
                                            {link.title}
                                        </span>
                                        {/* @ts-ignore */}
                                        {link.badge && (
                                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary/10 text-primary border border-primary/20 leading-none">
                                                {/* @ts-ignore */}
                                                {link.badge}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            </Link>
                        </div>
                    );
                })}
            </nav>

            <div className="p-4 mt-auto border-t border-sidebar-border">
                {user && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="w-full flex items-center gap-3 p-2 rounded hover:bg-sidebar-accent transition-all text-left group">
                                <Avatar className="h-8 w-8 border border-sidebar-border">
                                    <AvatarImage src={user.avatar || undefined} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs uppercase text-center flex items-center justify-center pt-0.5">
                                        {user.name?.[0] || user.email?.[0] || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-sidebar-foreground truncate">{user.name || 'User'}</p>
                                    <p className="text-[10px] text-sidebar-foreground/60 truncate font-medium">Account Settings</p>
                                </div>
                                <ChevronUp className="h-4 w-4 text-sidebar-foreground/40 group-hover:text-sidebar-foreground transition-opacity" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2 mb-2 rounded border-sidebar-border bg-sidebar shadow-xl" side="right" align="end" sideOffset={12}>
                             <div className="p-3">
                                <p className="text-xs font-black uppercase tracking-widest text-sidebar-foreground mb-1">{user.name || 'Account'}</p>
                                <p className="text-[10px] text-sidebar-foreground/60 truncate">{user.email}</p>
                            </div>
                            <Separator className="my-2 opacity-10" />
                            <div className="space-y-1">
                                <Link href={`/websites/${websiteId}/settings`}>
                                    <Button variant="ghost" size="sm" className="w-full justify-start h-9 text-xs font-bold gap-2 rounded">
                                        <Settings size={14} />
                                        Profile Settings
                                    </Button>
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => logout()}
                                    className="w-full justify-start h-9 text-xs font-bold gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded"
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
