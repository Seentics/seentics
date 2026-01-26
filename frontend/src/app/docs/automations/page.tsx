'use client';

import { Workflow, MousePointer2, Clock, MoveUpRight, Settings, Plus, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AutomationDocs() {
    return (
        <div className="space-y-12">
            <header className="space-y-4">
                <div className="flex items-center gap-3 text-orange-500">
                    <Workflow className="w-8 h-8" />
                    <h1 className="text-3xl font-bold tracking-tight">Automation Engine</h1>
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Transform insights into action. Automate user engagement based on real-time behavior
                    and precise conditions.
                </p>
            </header>

            <div className="rounded-2xl border-l-4 border-l-primary bg-primary/5 p-6 space-y-3">
                <div className="flex items-center gap-2 font-semibold">
                    <Info className="w-5 h-5 text-primary" />
                    <span>Core Concept</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Automations follow a <span className="text-foreground font-medium">Trigger → Condition → Action</span> flow.
                    When a trigger event occurs, Seentics checks your defined conditions. If they pass, the
                    configured actions are executed immediately.
                </p>
            </div>

            <section className="space-y-8">
                <h2 className="text-2xl font-semibold">1. Triggers</h2>
                <div className="space-y-4">
                    {[
                        { name: 'Element Click', desc: 'Fires when a user clicks a specific CSS selector (e.g., .buy-button).', icon: MousePointer2 },
                        { name: 'Page Visit', desc: 'Fires when a user enters a specific section of your site.', icon: MoveUpRight },
                        { name: 'Time Spent', desc: 'Trigger after a user has been idle or active on a page for X seconds.', icon: Clock },
                        { name: 'Exit Intent', desc: 'Detects when a user is about to leave the site based on mouse velocity.', icon: Plus },
                    ].map((trigger, i) => (
                        <div key={i} className="flex gap-6 p-6 rounded-2xl border bg-card hover:bg-muted/10 transition-colors">
                            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                                <trigger.icon className="w-6 h-6 text-orange-500" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold">{trigger.name}</h3>
                                    <Badge variant="secondary">Real-time</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{trigger.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">2. Smart Conditions</h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <CardSimple
                        title="New vs Returning"
                        content="Tailor your message based on whether it's the user's first visit or tenth."
                    />
                    <CardSimple
                        title="Device Intelligence"
                        content="Only show specific banners to mobile users or those with high-resolution screens."
                    />
                    <CardSimple
                        title="Traffic Source"
                        content="Change the experience for users arriving from a specific marketing campaign (UTM)."
                    />
                    <CardSimple
                        title="Historical Behavior"
                        content="Trigger actions based on whether the user has previously completed a conversion funnel."
                    />
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">3. Actions</h2>
                <p className="text-muted-foreground">What happens when your conditions are met?</p>
                <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-5 rounded-xl border bg-card space-y-2">
                        <h4 className="font-medium">Show Modal</h4>
                        <p className="text-xs text-muted-foreground">Interactive overlays for signups or feedback.</p>
                    </div>
                    <div className="p-5 rounded-xl border bg-card space-y-2">
                        <h4 className="font-medium">Notification</h4>
                        <p className="text-xs text-muted-foreground">Subtle push-style notifications at corner.</p>
                    </div>
                    <div className="p-5 rounded-xl border bg-card space-y-2">
                        <h4 className="font-medium">Webhook</h4>
                        <p className="text-xs text-muted-foreground">Send data to Slack, Discord, or your own server.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}

function CardSimple({ title, content }: { title: string, content: string }) {
    return (
        <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-sm space-y-2">
            <h3 className="font-semibold text-primary">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
        </div>
    );
}
