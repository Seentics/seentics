'use client';

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
    ChevronUp,
    Headset,
    Route,
    ChevronLeft,
    ChevronRight,
    Activity,
    Building,
    ArrowUpRight,
    Video,
    Zap,
    MessageSquare,
    Users,
    Key,
    X,
    BarChart3,
    Download,
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
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3020';
const SUITE_DOMAIN = process.env.NEXT_PUBLIC_SUITE_DOMAIN || 'seentics.com';

const switchProducts = [
    { name: 'Replays', icon: Video, subdomain: 'replays', port: '3007', color: 'text-purple-500', desc: 'Session recordings' },
    { name: 'Automation', icon: Zap, subdomain: 'automation', port: '3009', color: 'text-amber-500', desc: 'Workflow automation' },
    { name: 'Feedback', icon: MessageSquare, subdomain: 'feedback', port: '3005', color: 'text-emerald-500', desc: 'User feedback' },
    { name: 'Status', icon: Activity, subdomain: 'status', port: '3001', color: 'text-rose-500', desc: 'Uptime monitoring' },
];

function getSwitchUrl(subdomain: string, port: string) {
    const target = (SUITE_DOMAIN === 'localhost' || SUITE_DOMAIN.includes('localhost'))
        ? `http://localhost:${port}` : `https://${subdomain}.${SUITE_DOMAIN}`;
    return `${AUTH_URL}/switch?to=${encodeURIComponent(target)}`;
}

export function NavSidebar({ websiteId, mobile = false }: { websiteId: string; mobile?: boolean }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { isSidebarOpen, toggleSidebar, closeMobileMenu } = useLayoutStore();
    const [wsModalOpen, setWsModalOpen] = useState(false);

    const { subscription } = isEnterprise ? useSubscription() : { subscription: null };

    // Map nav items to subscription usage keys for limit-based hiding
    const featureLimitMap: Record<string, string> = {
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
            title: 'Realtime',
            href: `/websites/${websiteId}/realtime`,
            icon: Activity,
            description: 'Live Visitor Activity'
        },
        {
            title: 'Funnels',
            href: `/websites/${websiteId}/funnels`,
            icon: Filter,
            description: 'Conversion Journeys',
        },
        {
            title: 'Paths',
            href: `/websites/${websiteId}/paths`,
            icon: Route,
            description: 'User Journey Analysis',
            enterpriseOnly: true
        },
        {
            title: 'Billing',
            href: `/websites/${websiteId}/billing`,
            icon: CreditCard,
            description: 'Plan & Payment',
            enterpriseOnly: true
        },
        {
            title: 'Privacy',
            href: `/websites/${websiteId}/privacy`,
            icon: Shield,
            description: 'GDPR & Privacy',
            enterpriseOnly: true
        },
        {
            title: 'Settings',
            href: `/websites/${websiteId}/settings`,
            icon: Settings,
            description: 'General Preferences',
        },
        {
            title: 'Support',
            href: `/websites/${websiteId}/support`,
            icon: Headset,
            description: 'Help & Contact',
            enterpriseOnly: true
        },
    ];

    const links = allLinks.filter(link => {
        if (!isEnterprise && link.enterpriseOnly) return false;
        // Admin only items: hide if user is not admin
        if ((link as any).adminOnly && user?.role !== 'admin') return false;
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
                    {websiteId === 'demo' && (isSidebarOpen || mobile) && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-500 border border-indigo-500/20 leading-none">
                            Demo
                        </span>
                    )}
                </Link>
            </div>

            <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar pb-10">
                {links.map((link, idx) => {
                    const isActive = link.matchExact
                        ? pathname === link.href
                        : pathname.startsWith(link.href);

                    return (
                        <div key={`${link.title}-${idx}`} className="px-1">
                            <Link
                                href={link.href}
                                onClick={() => mobile && closeMobileMenu()}
                                className={cn(
                                    "flex items-center gap-3 px-3.5 py-2.5 rounded-lg group transition-all duration-200 relative",
                                    isActive
                                        ? "bg-accent text-primary font-medium"
                                        : "hover:bg-accent/50 text-muted-foreground font-medium",
                                    (!isSidebarOpen && !mobile) && "justify-center px-0"
                                )}
                            >
                                <link.icon size={18} className={cn(
                                    "shrink-0 transition-colors",
                                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                )} />
                                {(isSidebarOpen || mobile) && (
                                    <span className="text-sm tracking-tight">{link.title}</span>
                                )}
                            </Link>
                        </div>
                    );
                })}
            </nav>

            {/* Workspace Button */}
            <div className={cn(
                "px-5 pb-3",
                (!isSidebarOpen && !mobile) && "px-4 flex justify-center"
            )}>
                <button
                    onClick={() => setWsModalOpen(true)}
                    className={cn(
                        "flex items-center gap-3 w-full rounded-lg text-sm font-semibold transition-all duration-200 border",
                        "bg-accent/60 hover:bg-accent border-border/60 text-foreground",
                        (isSidebarOpen || mobile)
                            ? "px-3.5 py-2.5"
                            : "justify-center p-2.5"
                    )}
                >
                    <Building size={18} className="shrink-0" />
                    {(isSidebarOpen || mobile) && (
                        <>
                            <span className="flex-1 text-left tracking-tight">Workspace</span>
                            <ArrowUpRight size={14} className="text-muted-foreground" />
                        </>
                    )}
                </button>
            </div>

            {/* Workspace Modal */}
            {wsModalOpen && (
                <div className="fixed inset-0 z-[200]" onClick={() => setWsModalOpen(false)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
                    <div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] max-w-[95vw] max-h-[88vh] bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-accent/30">
                            <div className="flex items-center gap-3">
                                <Logo size="md" />
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">Seentics Analytics</h3>
                                    <p className="text-[11px] text-muted-foreground">Command center</p>
                                </div>
                            </div>
                            <button onClick={() => setWsModalOpen(false)} className="p-2 rounded-lg hover:bg-accent transition-colors">
                                <X size={16} className="text-muted-foreground" />
                            </button>
                        </div>

                        {/* Two-column body */}
                        <div className="grid grid-cols-2 divide-x divide-border/40">
                            {/* Left: Analytics actions */}
                            <div className="p-4">
                                <p className="px-2 pb-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Analytics</p>
                                <div className="space-y-0.5">
                                    {[
                                        { name: 'Realtime', icon: Activity, href: `/websites/${websiteId}/realtime`, color: 'text-emerald-500' },
                                        { name: 'Funnels', icon: Filter, href: `/websites/${websiteId}/funnels`, color: 'text-orange-500' },
                                        { name: 'User Paths', icon: Route, href: `/websites/${websiteId}/paths`, color: 'text-violet-500' },
                                        { name: 'Privacy', icon: Shield, href: `/websites/${websiteId}/privacy`, color: 'text-sky-500' },
                                        { name: 'Site Settings', icon: Settings, href: `/websites/${websiteId}/settings`, color: 'text-gray-500' },
                                    ].map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => { setWsModalOpen(false); mobile && closeMobileMenu(); }}
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
                                        >
                                            <item.icon size={15} className={`shrink-0 ${item.color}`} />
                                            <span className="text-[13px] font-medium text-foreground">{item.name}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Products + Workspace */}
                            <div className="p-4 overflow-y-auto max-h-[60vh]">
                                <p className="px-2 pb-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Switch Product</p>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    {switchProducts.map((p) => (
                                        <a
                                            key={p.subdomain}
                                            href={getSwitchUrl(p.subdomain, p.port)}
                                            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/40 hover:border-border hover:bg-accent/50 transition-all text-center group"
                                        >
                                            <div className={cn(
                                                "w-9 h-9 rounded-lg flex items-center justify-center",
                                                p.color === 'text-purple-500' && 'bg-purple-500/10',
                                                p.color === 'text-amber-500' && 'bg-amber-500/10',
                                                p.color === 'text-emerald-500' && 'bg-emerald-500/10',
                                                p.color === 'text-rose-500' && 'bg-rose-500/10',
                                            )}>
                                                <p.icon size={17} className={cn("shrink-0", p.color)} />
                                            </div>
                                            <span className="text-xs font-semibold text-foreground">{p.name}</span>
                                        </a>
                                    ))}
                                </div>

                                <Separator className="my-3" />

                                <p className="px-2 pb-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Workspace</p>
                                <div className="space-y-0.5">
                                    {[
                                        { name: 'Dashboard', icon: Building, href: '/workspace' },
                                        { name: 'Team', icon: Users, href: '/workspace/members' },
                                        { name: 'Billing', icon: CreditCard, href: '/workspace/billing' },
                                        { name: 'API Keys', icon: Key, href: '/workspace/api-keys' },
                                        { name: 'Settings', icon: Settings, href: '/workspace/settings' },
                                    ].map((item) => (
                                        <a
                                            key={item.href}
                                            href={`${AUTH_URL}${item.href}`}
                                            className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent transition-colors group/ws"
                                        >
                                            <span className="flex items-center gap-2.5">
                                                <item.icon size={14} className="text-muted-foreground" />
                                                <span className="text-[13px] font-medium text-foreground">{item.name}</span>
                                            </span>
                                            <ArrowUpRight size={11} className="text-muted-foreground/30 group-hover/ws:text-foreground transition-colors" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
