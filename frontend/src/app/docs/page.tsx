'use client';

import {
    Rocket,
    ShieldCheck,
    Zap,
    ArrowRight,
    ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function DocsIntroduction() {
    return (
        <div className="space-y-12">
            {/* Hero Section */}
            <section className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                    Welcome to Seentics
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    The privacy-first, high-performance analytics platform designed for modern product teams.
                    Get detailed insights into user behavior without compromising on performance or privacy.
                </p>
                <div className="flex flex-wrap gap-4 pt-4">
                    <Link
                        href="/docs/quick-start"
                        className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition flex items-center gap-2"
                    >
                        Quick Start Guide <Rocket className="w-4 h-4" />
                    </Link>
                    <Link
                        href="/docs/tracker"
                        className="px-6 py-3 bg-muted text-foreground border rounded-lg font-medium hover:bg-muted/80 transition"
                    >
                        Install Tracker
                    </Link>
                </div>
            </section>

            {/* Philosophy */}
            <section className="grid md:grid-cols-3 gap-8">
                <div className="space-y-3 p-6 rounded-2xl bg-card border border-border/50">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg">Performance First</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Our tracker is optimized for speed, using idle-time dispatching to ensures zero impact on your site's SEO and Core Web Vitals.
                    </p>
                </div>

                <div className="space-y-3 p-6 rounded-2xl bg-card border border-border/50">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-blue-500" />
                    </div>
                    <h3 className="font-semibold text-lg">Privacy by Design</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        GDPR and CCPA compliant out of the box. We never track PII (Personally Identifiable Information) without explicit consent.
                    </p>
                </div>

                <div className="space-y-3 p-6 rounded-2xl bg-card border border-border/50">
                    <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                        <Rocket className="w-5 h-5 text-violet-500" />
                    </div>
                    <h3 className="font-semibold text-lg">Actionable Insights</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Go beyond metrics with visual funnels and automated behavior triggers that help you convert more visitors.
                    </p>
                </div>
            </section>

            {/* Main Sections */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Explore Features</h2>
                <div className="grid gap-4">
                    {[
                        {
                            title: 'Real-time Analytics',
                            desc: 'Understand your current traffic, sources, and user demographics in real-time.',
                            href: '/docs/analytics'
                        },
                        {
                            title: 'Behavioral Funnels',
                            desc: 'Map out user journeys and identify high-impact dropoff points.',
                            href: '/docs/funnels'
                        },
                        {
                            title: 'Automation Engine',
                            desc: 'Engage users based on their actions with modals, banners, and webhooks.',
                            href: '/docs/automations'
                        }
                    ].map((feature) => (
                        <Link
                            key={feature.href}
                            href={feature.href}
                            className="group p-6 rounded-2xl border bg-card hover:border-primary/50 transition-all duration-300 flex items-center justify-between"
                        >
                            <div className="space-y-1">
                                <h3 className="font-medium group-hover:text-primary transition-colors">{feature.title}</h3>
                                <p className="text-sm text-muted-foreground">{feature.desc}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
                        </Link>
                    ))}
                </div>
            </section>

            {/* Help Footer */}
            <div className="p-8 rounded-3xl bg-primary/5 border border-primary/10 text-center space-y-4">
                <h3 className="text-xl font-semibold">Need more help?</h3>
                <p className="text-muted-foreground max-w-lg mx-auto">
                    Our support team is available 24/7 via the global chat messenger in the bottom right corner of the dashboard.
                </p>
                <button
                    onClick={() => (window as any).Tawk_API?.toggle()}
                    className="text-primary font-medium hover:underline flex items-center gap-1 mx-auto"
                >
                    Talk to an expert <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
