'use client';

import { BarChart3, LineChart, PieChart, Users, Globe, ExternalLink, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AnalyticsDocs() {
    return (
        <div className="space-y-12">
            <header className="space-y-4">
                <div className="flex items-center gap-3 text-primary">
                    <BarChart3 className="w-8 h-8" />
                    <h1 className="text-3xl font-bold tracking-tight">Real-time Analytics</h1>
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Monitor your application's health and user engagement in real-time. Seentics provides
                    deep insights into every interaction.
                </p>
            </header>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Key Metrics</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                    {[
                        {
                            title: 'Unique Visitors',
                            desc: 'Count of distinct individuals visiting your site within a specific time period.',
                            icon: Users
                        },
                        {
                            title: 'Session Duration',
                            desc: 'Average time spent on your site, helping you measure content relevance.',
                            icon: Clock
                        },
                        {
                            title: 'Bounce Rate',
                            desc: 'Percentage of users who leave after viewing only one page.',
                            icon: ExternalLink
                        },
                        {
                            title: 'Real-time Visitors',
                            desc: 'Active users currently navigating your site right now.',
                            icon: Zap
                        }
                    ].map((metric) => (
                        <div key={metric.title} className="flex gap-4 p-5 rounded border bg-card/50">
                            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                <metric.icon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="font-medium">{metric.title}</h4>
                                <p className="text-sm text-muted-foreground">{metric.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="space-y-6">
                <div className="p-8 rounded bg-primary shadow-2xl overflow-hidden relative">
                    <div className="relative z-10 space-y-4">
                        <h2 className="text-2xl font-bold text-white">Geographic Insights</h2>
                        <p className="text-primary-foreground/90 max-w-xl">
                            Our privacy-safe geolocation engine resolves IP addresses to country and city levels
                            without storing PII, allowing you to optimize your global reach.
                        </p>
                    </div>
                    <Globe className="absolute -bottom-12 -right-12 w-64 h-64 text-white/10" />
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Custom Events</h2>
                <p className="text-muted-foreground">
                    Track specific user actions like signups, trial starts, or feature usage using
                    our lightweight API.
                </p>
                <div className="rounded border bg-muted/30 overflow-hidden">
                    <div className="px-4 py-2 border-b bg-muted/50 flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">javascript</span>
                        <span className="text-[10px] uppercase font-bold text-primary">Copy</span>
                    </div>
                    <pre className="p-6 text-sm font-mono overflow-x-auto text-muted-foreground">
                        <code>
                            {`// Track a basic interaction
seentics.track('Video Play');

// Track an interaction with properties
seentics.track('Upgrade Plan', {
  plan: 'Pro',
  billingCycle: 'Annual'
});`}
                        </code>
                    </pre>
                </div>
            </section>
        </div>
    );
}

const Clock = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);
