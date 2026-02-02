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
    FileText,
    Activity
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
        <aside className="w-[280px] h-screen fixed top-0 left-0 bg-sidebar/70 dark:bg-sidebar/40 backdrop-blur-2xl border-r border-sidebar-border/30 flex flex-col hidden lg:flex z-50">
            <div className="p-8 pb-8">
                <Link href="/" className="flex items-center gap-3 group transition-transform hover:scale-[1.02]">
                    <Logo size="xl" showText={true} textClassName="text-xl font-bold tracking-tight text-foreground" />
                </Link>
            </div>

            <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar pb-10">
                {links.map((link) => {
                    const isActive = link.matchExact
                        ? pathname === link.href
                        : pathname.startsWith(link.href);

                    // All links are now enabled for demo mode
                    const isDisabled = false;

                    return (
                        <div key={link.href} className="px-1">
                             {/* @ts-ignore */}
                            {link.separator && (
                                <div className="px-3 pt-6 pb-2">
                                    <div className="h-[1px] bg-sidebar-border/20 mb-3" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 block pl-1">Module: Experimental</span>
                                </div>
                            )}
                            <Link 
                                href={link.href} 
                                className={cn("block relative group", isDisabled && "pointer-events-none opacity-50 grayscale")}
                            >
                                {isActive && (
                                    <motion.div 
                                        layoutId="active-nav-bg"
                                        className="absolute inset-0 bg-primary/10 dark:bg-primary/5 rounded-xl border border-primary/20"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                                {isActive && (
                                    <motion.div 
                                        layoutId="active-nav-indicator"
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-r-full shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                    />
                                )}
                                
                                <div className={cn(
                                    "relative flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-300",
                                    isActive
                                        ? "text-primary shadow-sm"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                )}>
                                    <div className="relative">
                                        <link.icon className={cn(
                                            "h-[18px] w-[18px] shrink-0 transition-all duration-500", 
                                            isActive ? "scale-110 text-primary" : "text-muted-foreground group-hover:text-foreground group-hover:scale-110"
                                        )} />
                                        {/* @ts-ignore */}
                                        {link.isNew && (
                                            <span className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-sidebar"></span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center justify-between">
                                            <span className={cn(
                                                "font-bold text-[13px] tracking-tight leading-tight truncate", 
                                                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                            )}>
                                                {link.title}
                                            </span>
                                            {/* @ts-ignore */}
                                            {link.badge && (
                                                <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter rounded-md bg-muted/40 text-muted-foreground/60 border border-border/40 group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 leading-none transition-colors">
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

            <div className="p-6 mt-auto bg-gradient-to-t from-sidebar/50 to-transparent">
                {user && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-muted/20 dark:bg-muted/10 border border-border/10 hover:border-primary/20 hover:bg-muted transition-all text-left group shadow-sm active:scale-95 duration-200">
                                <Avatar className="h-9 w-9 border-2 border-background shadow-md group-hover:scale-105 transition-transform">
                                    <AvatarImage src={user.avatar || undefined} />
                                    <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs uppercase text-center flex items-center justify-center pt-0.5">
                                        {user.name?.[0] || user.email?.[0] || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-foreground truncate uppercase tracking-tight">{user.name || 'User'}</p>
                                    <p className="text-[10px] text-muted-foreground/60 truncate font-bold uppercase tracking-widest leading-none mt-0.5">Settings</p>
                                </div>
                                <ChevronUp className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-all duration-300 group-hover:-translate-y-0.5" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0 mb-3 rounded-2xl border-border/40 bg-card/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)]" side="right" align="end" sideOffset={12}>
                             <div className="p-4 bg-muted/20 rounded-t-2xl">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 mb-1">Active Session</p>
                                <p className="text-sm font-black text-foreground">{user.name || 'Account'}</p>
                                <p className="text-[10px] text-muted-foreground font-medium truncate opacity-60 mt-0.5">{user.email}</p>
                            </div>
                            <Separator className="opacity-10" />
                            <div className="p-2 space-y-1">
                                <Link href={`/websites/${websiteId}/settings`}>
                                    <Button variant="ghost" size="sm" className="w-full justify-start h-10 text-xs font-bold gap-3 rounded-xl hover:bg-muted group">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                            <Settings size={14} />
                                        </div>
                                        Profile Settings
                                    </Button>
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => logout()}
                                    className="w-full justify-start h-10 text-xs font-bold gap-3 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                                        <LogOut size={14} />
                                    </div>
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
