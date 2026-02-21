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
import { isEnterprise } from '@/lib/features';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';

export function NavSidebar({ websiteId, mobile = false }: { websiteId: string; mobile?: boolean }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { isSidebarOpen, toggleSidebar, closeMobileMenu } = useLayoutStore();

    const isDemo = websiteId === 'demo';
    const { subscription } = isEnterprise ? useSubscription() : { subscription: null };

    // Map nav items to subscription usage keys for limit-based hiding
    const featureLimitMap: Record<string, string> = {
        'Heatmaps': 'heatmaps',
        'Session Replay': 'replays',
        'Automations': 'workflows',
        'Funnels': 'funnels',
    };

    const allLinks = [
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
            isLocked: isDemo,
            enterpriseOnly: true
        },
        {
            title: 'Privacy',
            href: `/websites/${websiteId}/privacy`,
            icon: Shield,
            description: 'GDPR & Privacy',
            isLocked: isDemo,
            enterpriseOnly: true
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
            isLocked: isDemo,
            enterpriseOnly: true
        },
    ];

    const links = allLinks.filter(link => {
        // OSS mode: hide enterprise-only items
        if (!isEnterprise && link.enterpriseOnly) return false;
        // Enterprise mode: hide features where subscription limit is 0
        if (isEnterprise && subscription) {
            const usageKey = featureLimitMap[link.title];
            if (usageKey) {
                const usage = subscription.usage[usageKey as keyof typeof subscription.usage];
                if (usage && usage.limit === 0) return false;
            }
        }
        return true;
    });

    const containerClasses = mobile
        ? "h-full w-full bg-background flex flex-col"
        : cn(
            "h-screen fixed top-0 left-0 bg-card border-r border-border/60 flex flex-col hidden lg:flex z-50 transition-all duration-300 ease-in-out",
            isSidebarOpen ? "w-[260px]" : "w-[72px]"
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
                                    "flex items-center gap-3 px-3.5 py-2.5 rounded-lg group transition-all duration-200 relative",
                                    isActive
                                        ? "bg-accent text-primary font-medium"
                                        : "hover:bg-accent/50 text-muted-foreground font-medium",
                                    (!isSidebarOpen && !mobile) && "justify-center px-0",
                                    isDisabled && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <link.icon size={18} className={cn(
                                    "shrink-0 transition-colors",
                                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                )} />
                                {(isSidebarOpen || mobile) && (
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm tracking-tight">{link.title}</span>
                                            {(link as any).isLocked && (
                                                <Lock size={12} className="text-muted-foreground/60" />
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
                                "flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-accent/50 transition-colors group",
                                (!isSidebarOpen && !mobile) && "justify-center p-2"
                            )}>
                                <Avatar className="h-8 w-8 border border-border/60">
                                    <AvatarImage src={user.avatar || undefined} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                                        {user.name?.[0] || user.email?.[0] || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                {(isSidebarOpen || mobile) && (
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className="text-sm font-medium text-foreground truncate">{user.name || 'User'}</p>
                                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                    </div>
                                )}
                                {(isSidebarOpen || mobile) && <ChevronUp className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0 mb-3 rounded-lg border-border/60 bg-card shadow-sm" side={(isSidebarOpen || mobile) ? "top" : "right"} align={(isSidebarOpen || mobile) ? "center" : "end"} sideOffset={12}>
                            <div className="p-3 border-b border-border/40">
                                <p className="text-sm font-medium text-foreground">{user.name || 'Account'}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
                            </div>
                            <div className="p-1.5">
                                <Link href={`/websites/${websiteId}/settings`} onClick={() => mobile && closeMobileMenu()}>
                                    <Button variant="ghost" size="sm" className="w-full justify-start h-9 text-xs font-medium gap-2.5 rounded-md hover:bg-accent">
                                        <Settings size={14} className="text-muted-foreground" />
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
        </aside>
    );
}
