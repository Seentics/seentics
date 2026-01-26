'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    BarChart3,
    Workflow,
    Filter,
    CreditCard,
    ShieldCheck,
    Zap,
    BookOpen,
    Code2,
    Settings,
    Rocket
} from 'lucide-react';

const sidebarItems = [
    {
        title: 'Getting Started',
        items: [
            { title: 'Introduction', href: '/docs', icon: BookOpen },
            { title: 'Quick Start', href: '/docs/quick-start', icon: Rocket },
        ]
    },
    {
        title: 'Core Features',
        items: [
            { title: 'Analytics', href: '/docs/analytics', icon: BarChart3 },
            { title: 'Funnels', href: '/docs/funnels', icon: Filter },
            { title: 'Automations', href: '/docs/automations', icon: Workflow },
        ]
    },
    {
        title: 'Integration',
        items: [
            { title: 'Tracker Script', href: '/docs/tracker', icon: Zap },
            { title: 'API Reference', href: '/docs/api', icon: Code2 },
        ]
    },
    {
        title: 'Platform',
        items: [
            { title: 'Billing & Plans', href: '/docs/billing', icon: CreditCard },
            { title: 'Privacy & Security', href: '/docs/privacy', icon: ShieldCheck },
        ]
    }
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex min-h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-card/30 backdrop-blur-md hidden md:flex flex-col sticky top-0 h-screen">
                <div className="p-6 border-b">
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
                        <span className="text-primary text-2xl">S</span>
                        <span>Documentation</span>
                    </Link>
                </div>
                <nav className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
                    {sidebarItems.map((group) => (
                        <div key={group.title} className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">
                                {group.title}
                            </h4>
                            <div className="space-y-1">
                                {group.items.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 group",
                                            pathname === item.href
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        <item.icon className={cn(
                                            "w-4 h-4",
                                            pathname === item.href ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                        )} />
                                        {item.title}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 md:py-16">
                    <div className="glass-card p-1 items-center gap-2 mb-8 hidden md:inline-flex rounded-full bg-muted/50 border px-3 py-1 text-xs text-muted-foreground">
                        <Settings className="w-3 h-3" />
                        <span>Updated Jan 2026</span>
                    </div>
                    {children}
                </div>
            </main>
        </div>
    );
}
