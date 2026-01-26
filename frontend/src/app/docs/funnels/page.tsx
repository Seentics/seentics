'use client';

import { Filter, Target, TrendingDown, MousePointerClick, CheckCircle2 } from 'lucide-react';

export default function FunnelDocs() {
    return (
        <div className="space-y-12">
            <header className="space-y-4">
                <div className="flex items-center gap-3 text-violet-500">
                    <Filter className="w-8 h-8" />
                    <h1 className="text-3xl font-bold tracking-tight">Behavioral Funnels</h1>
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Visualize your user conversion journeys and identify where you're losing potential customers.
                </p>
            </header>

            {/* Visual representation */}
            <div className="grid md:grid-cols-2 gap-8">
                <section className="space-y-6">
                    <h2 className="text-2xl font-semibold text-foreground">Why Funnels?</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Standard analytics tell you what happened. Funnels tell you where the momentum stopped.
                        By mapping out specific steps, you can:
                    </p>
                    <ul className="space-y-4">
                        {[
                            { text: 'Detect high-friction pages during checkout', icon: TrendingDown },
                            { text: 'Measure the impact of UI changes on conversion', icon: MousePointerClick },
                            { text: 'Identify loyal user segments', icon: Target },
                        ].map((item, i) => (
                            <li key={i} className="flex items-start gap-3 group">
                                <div className="mt-1 w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                                    <item.icon className="w-3 h-3 text-violet-500" />
                                </div>
                                <span className="text-muted-foreground group-hover:text-foreground transition-colors">{item.text}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <div className="bg-muted/30 rounded-2xl border p-8 space-y-4 flex flex-col justify-center">
                    <div className="space-y-2">
                        <div className="w-full bg-primary/20 h-10 rounded-lg flex items-center justify-between px-4 border border-primary/20">
                            <span className="text-xs font-medium">1. Landing Page</span>
                            <span className="text-xs font-bold text-primary">100%</span>
                        </div>
                        <div className="w-[85%] bg-primary/20 h-10 rounded-lg flex items-center justify-between px-4 border border-primary/20">
                            <span className="text-xs font-medium">2. Pricing View</span>
                            <span className="text-xs font-bold text-primary">85%</span>
                        </div>
                        <div className="w-[45%] bg-primary/20 h-10 rounded-lg flex items-center justify-between px-4 border border-primary/20">
                            <span className="text-xs font-medium">3. Sign Up</span>
                            <span className="text-xs font-bold text-primary">45%</span>
                        </div>
                        <div className="w-[12%] bg-violet-500/40 h-10 rounded-lg flex items-center justify-between px-4 border border-violet-500/40">
                            <span className="text-xs font-medium">4. Payment</span>
                            <span className="text-xs font-bold text-violet-500">12%</span>
                        </div>
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground font-mono">Example Funnel Visualization</p>
                </div>
            </div>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Step Types</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-6 rounded-2xl bg-card border">
                        <h3 className="font-semibold mb-2">Page View Steps</h3>
                        <p className="text-sm text-muted-foreground">Triggered when a user visits a specific URL. Dynamic paths are supported using wildcards (e.g., /products/*).</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-card border">
                        <h3 className="font-semibold mb-2">Event Steps</h3>
                        <p className="text-sm text-muted-foreground">Triggered when a custom event is fired or a specific CSS selector is clicked.</p>
                    </div>
                </div>
            </section>

            <section className="p-8 rounded-3xl border bg-card/50 relative overflow-hidden">
                <CheckCircle2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 text-primary/5" />
                <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                    <h2 className="text-2xl font-bold">Ready to track?</h2>
                    <p className="text-muted-foreground max-w-xl">
                        Funnels are calculated in real-time. Once you create a funnel, historical data (if available)
                        will be retroactively applied within 1 hour.
                    </p>
                </div>
            </section>
        </div>
    );
}
