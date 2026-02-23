'use client';

import React from 'react';
import { useAuth } from '@/stores/useAuthStore';
import { redirect, usePathname } from 'next/navigation';
import { isEnterprise } from '@/lib/features';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Settings,
    ShieldCheck,
    LogOut,
    Menu,
    Database,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { AdminLogin } from '@/components/admin/AdminLogin';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isLoading, isAdminVerified, logout } = useAuth();
    const pathname = usePathname();
    const { isSidebarOpen, toggleSidebar, toggleMobileMenu } = useLayoutStore();

    if (isLoading) return null;

    // Protection: Only enterprise admins can see this
    if (!isAuthenticated || !isEnterprise || user?.role !== 'admin') {
        redirect('/');
    }

    // Secondary Protection: Three-field secret match
    if (!isAdminVerified) {
        return <AdminLogin />;
    }

    const adminLinks = [
        { title: 'Overview', href: '/admin', icon: LayoutDashboard },
        { title: 'Support Inbox', href: '/admin/support', icon: MessageSquare },
        { title: 'Manage Users', href: '/admin/users', icon: Users },
        { title: 'Databases', href: '/admin/databases', icon: Database },
        { title: 'Security', href: '/admin/security', icon: ShieldCheck },
        { title: 'Settings', href: '/admin/settings', icon: Settings },
    ];

    return (
        <div className="flex bg-background text-foreground min-h-screen">
            {/* Admin Sidebar */}
            <aside className={cn(
                "h-screen fixed top-0 left-0 bg-card border-r border-border/30 flex-col hidden lg:flex z-50 transition-all duration-300",
                isSidebarOpen ? "w-[240px]" : "w-[72px]"
            )}>
                {/* Logo */}
                <div className="p-5 pb-6">
                    <Link href="/admin" className="flex items-center gap-2.5">
                        <Logo size={isSidebarOpen ? "xl" : "lg"} showText={isSidebarOpen} />
                        {isSidebarOpen && (
                            <Badge
                                variant="secondary"
                                className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black tracking-wider uppercase px-1.5 py-0 h-4"
                            >
                                Admin
                            </Badge>
                        )}
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 space-y-1">
                    {adminLinks.map((link) => {
                        const isActive = pathname === link.href;
                        return (
                            <Link
                                key={link.title}
                                href={link.href}
                                title={link.title}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/15 font-bold"
                                        : "hover:bg-muted/60 text-muted-foreground hover:text-foreground",
                                    !isSidebarOpen && "justify-center px-0"
                                )}
                            >
                                <link.icon size={18} className={cn(
                                    "shrink-0",
                                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                                )} />
                                {isSidebarOpen && <span className="text-[13px]">{link.title}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Section */}
                <div className="p-3 space-y-2 border-t border-border/20">
                    {/* Theme + Collapse row */}
                    <div className={cn("flex items-center", isSidebarOpen ? "justify-between px-1" : "justify-center")}>
                        <ThemeToggle />
                        {isSidebarOpen && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleSidebar}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                                <ChevronLeft size={16} />
                            </Button>
                        )}
                    </div>

                    {!isSidebarOpen && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleSidebar}
                            className="w-full h-8 text-muted-foreground hover:text-foreground"
                        >
                            <ChevronRight size={16} />
                        </Button>
                    )}

                    {/* User info */}
                    {isSidebarOpen && (
                        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-muted/30">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-black text-primary">
                                {(user?.name?.charAt(0) || user?.email?.charAt(0) || 'A').toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold truncate">{user?.name || user?.email}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                            </div>
                        </div>
                    )}

                    {/* Logout */}
                    <Button
                        variant="ghost"
                        onClick={() => logout()}
                        className={cn(
                            "w-full flex items-center gap-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg h-9",
                            !isSidebarOpen && "justify-center px-0"
                        )}
                    >
                        <LogOut size={16} />
                        {isSidebarOpen && <span className="text-xs font-bold">Log out</span>}
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={cn(
                "flex-1 w-full min-w-0 transition-all duration-300",
                isSidebarOpen ? "lg:ml-[240px]" : "lg:ml-[72px]"
            )}>
                {/* Mobile Header */}
                <div className="lg:hidden h-14 bg-card border-b border-border/30 flex items-center justify-between px-4 sticky top-0 z-40">
                    <Link href="/admin" className="flex items-center gap-2">
                        <Logo size="lg" showText={true} />
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px] font-black uppercase px-1.5 py-0 h-4">
                            Admin
                        </Badge>
                    </Link>
                    <div className="flex items-center gap-1">
                        <ThemeToggle />
                        <Button variant="ghost" size="icon" onClick={toggleMobileMenu} className="h-9 w-9">
                            <Menu className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {children}
            </main>
        </div>
    );
}
