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
    ChevronUp,
    Headset,
    Mail,
    MessageSquare,
    FileText,
    ChevronLeft,
    ChevronRight,
    MousePointer2,
    Video,
    Lock,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/stores/useAuthStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export function NavSidebar({ websiteId, mobile = false }: { websiteId: string; mobile?: boolean }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { isSidebarOpen, toggleSidebar, closeMobileMenu } = useLayoutStore();

    const isDemo = websiteId === 'demo';

    const links = [
        {
            title: 'Overview',
            href: `/websites/${websiteId}`,
            icon: LayoutDashboard,
            matchExact: true,
            description: 'Traffic & Summary'
        },
        {
            title: 'Heatmaps',
            href: `/websites/${websiteId}/heatmaps`,
            icon: MousePointer2,
            description: 'User Interaction Maps'
        },
        {
            title: 'Session Replay',
            href: `/websites/${websiteId}/replays`,
            icon: Video,
            description: 'Watch User Sessions'
        },
        {
            title: 'Automations',
            href: `/websites/${websiteId}/automations`,
            icon: Workflow,
            description: 'Workflows & Triggers',
            isLocked: isDemo
        },
        {
            title: 'Funnels',
            href: `/websites/${websiteId}/funnels`,
            icon: Filter,
            description: 'Conversion Journeys',
            isLocked: isDemo
        },
        
        {
            title: 'Billing',
            href: `/websites/${websiteId}/billing`,
            icon: CreditCard,
            description: 'Plan & Payment',
            isLocked: isDemo
        },
        {
            title: 'Privacy',
            href: `/websites/${websiteId}/privacy`,
            icon: Shield,
            description: 'GDPR & Privacy',
            isLocked: isDemo
        },
        {
            title: 'Settings',
            href: `/websites/${websiteId}/settings`,
            icon: Settings,
            description: 'General Preferences',
            isLocked: isDemo
        },
        {
            title: 'Support',
            href: `/websites/${websiteId}/support`,
            icon: Headset,
            description: 'Help & Contact',
            isLocked: isDemo
        },
        {
            title: 'Emails',
            href: '#',
            icon: Mail,
            description: 'Email Marketing',
            badge: 'Upcoming',
            separator: true,
            isLocked: isDemo
        },
        {
            title: 'Support Desk',
            href: '#',
            icon: MessageSquare,
            description: 'Help Desk',
            badge: 'Upcoming',
            isLocked: isDemo
        },
        {
            title: 'Forms',
            href: '#',
            icon: FileText,
            description: 'Lead Gen Forms',
            badge: 'Upcoming',
            isLocked: isDemo
        }
    ];

    const containerClasses = mobile 
        ? "h-full w-full bg-white dark:bg-sidebar/40 flex flex-col"
        : cn(
            "h-screen fixed top-0 left-0 bg-white dark:bg-sidebar/40 backdrop-blur-2xl border-r border-sidebar-border/30 flex flex-col hidden lg:flex z-50 transition-all duration-300 ease-in-out",
            isSidebarOpen ? "w-[280px]" : "w-[80px]"
        );

    return (
        <aside className={containerClasses}>
            {/* Toggle Button - Only on Desktop */}
            {!mobile && (
                <button 
                    onClick={toggleSidebar}
                    className="absolute -right-3 top-20 bg-background border border-sidebar-border/50 rounded-full p-1.5 hover:bg-accent transition-colors z-[60] shadow-sm"
                >
                    {isSidebarOpen ? (
                        <ChevronLeft size={14} className="text-muted-foreground" />
                    ) : (
                        <ChevronRight size={14} className="text-muted-foreground" />
                    )}
                </button>
            )}

            <div className={cn(
                "p-8 pb-8 transition-all duration-300", 
                (!isSidebarOpen && !mobile) && "p-4 flex justify-center",
                mobile && "p-6"
            )}>
                <Link href="/" className="flex items-center gap-3 group transition-transform">
                    <Logo size={(isSidebarOpen || mobile) ? "xl" : "lg"} showText={isSidebarOpen || mobile} textClassName="text-xl font-bold tracking-tight text-foreground" />
                </Link>
            </div>

            <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar pb-10">
                {links.map((link, idx) => {
                    const isActive = link.matchExact
                        ? pathname === link.href
                        : pathname.startsWith(link.href);

                    const isDisabled = link.href === '#' || (link as any).isLocked;

                    return (
                        <div key={`${link.title}-${idx}`} className="px-1">
                            {link.separator && (isSidebarOpen || mobile) && (
                                <div className="px-3 pt-6 pb-2">
                                    <div className="h-[1px] bg-sidebar-border/20 mb-3" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 block pl-1 whitespace-nowrap">Module: Experimental</span>
                                </div>
                            )}
                            {link.separator && (!isSidebarOpen && !mobile) && (
                                <div className="my-4 h-[1px] bg-sidebar-border/20 mx-2" />
                            )}
                            <Link 
                                href={isDisabled ? '#' : link.href}
                                onClick={(e) => {
                                    if (isDisabled) {
                                        e.preventDefault();
                                        if ((link as any).isLocked) {
                                            toast.error("This feature is restricted in the demo environment.");
                                        }
                                        return;
                                    }
                                    mobile && closeMobileMenu();
                                }}
                                className={cn(
                                    "flex items-center gap-3 px-3.5 py-3 rounded group transition-all duration-200 relative",
                                    isActive 
                                        ? "bg-primary text-white shadow-xl shadow-primary/20 font-bold" 
                                        : "hover:bg-sidebar-accent/50 text-muted-foreground font-medium",
                                    (!isSidebarOpen && !mobile) && "justify-center px-0",
                                    isDisabled && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <link.icon size={20} className={cn(
                                    "shrink-0 transition-transform duration-300",
                                    isActive ? "text-white" : "text-muted-foreground group-hover:scale-110 group-hover:text-primary"
                                )} />
                                {(isSidebarOpen || mobile) && (
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm tracking-tight">{link.title}</span>
                                            {(link as any).isLocked && (
                                                <Lock size={12} className="text-muted-foreground/60" />
                                            )}
                                            {link.badge && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-black uppercase">
                                                    {link.badge}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Link>
                        </div>
                    );
                })}
            </nav>

            <div className={cn(
                "p-4 border-t border-sidebar-border/20",
                (!isSidebarOpen && !mobile) && "flex justify-center"
            )}>
                {user && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className={cn(
                                "flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-sidebar-accent/50 transition-all duration-300 group ring-primary/20 hover:ring-2 backdrop-blur-sm",
                                (!isSidebarOpen && !mobile) && "justify-center p-2"
                            )}>
                                <Avatar className="h-9 w-9 border-2 border-background shadow-md group-hover:scale-105 transition-transform">
                                    <AvatarImage src={user.avatar || undefined} />
                                    <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs uppercase text-center flex items-center justify-center pt-0.5">
                                        {user.name?.[0] || user.email?.[0] || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                {(isSidebarOpen || mobile) && (
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className="text-xs font-black text-foreground truncate uppercase tracking-tight">{user.name || 'User'}</p>
                                        <p className="text-[10px] text-muted-foreground/60 truncate font-bold uppercase tracking-widest leading-none mt-0.5">Settings</p>
                                    </div>
                                )}
                                {(isSidebarOpen || mobile) && <ChevronUp className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-all duration-300 group-hover:-translate-y-0.5" />}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0 mb-3 rounded-2xl border-border/40 bg-card/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)]" side={(isSidebarOpen || mobile) ? "top" : "right"} align={(isSidebarOpen || mobile) ? "center" : "end"} sideOffset={12}>
                             <div className="p-4 bg-muted/20 rounded-t-2xl">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 mb-1">Active Session</p>
                                <p className="text-sm font-black text-foreground">{user.name || 'Account'}</p>
                                <p className="text-[10px] text-muted-foreground font-medium truncate opacity-60 mt-0.5">{user.email}</p>
                            </div>
                            <Separator className="opacity-10" />
                            <div className="p-2 space-y-1">
                                <Link href={`/websites/${websiteId}/settings`} onClick={() => mobile && closeMobileMenu()}>
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
                                    onClick={() => {
                                        mobile && closeMobileMenu();
                                        logout();
                                    }}
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
