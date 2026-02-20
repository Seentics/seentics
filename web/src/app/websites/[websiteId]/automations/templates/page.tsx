'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Zap,
    Scroll,
    ArrowLeft,
    Gift,
    UserCheck,
    Bell,
    Webhook,
    Tag,
    ChevronRight,
    Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard-header';

const templates = [
    {
        id: 'welcome-modal',
        name: 'Welcome Modal',
        description: 'Engage new visitors with a personalized greeting modal.',
        category: 'Lead Gen',
        icon: UserCheck,
        difficulty: 'Easy',
        color: 'blue',
    },
    {
        id: 'exit-intent-promotion',
        name: 'Exit Intent Discount',
        description: 'Capture abandoning users with a special offer before they leave.',
        category: 'Sales',
        icon: Gift,
        difficulty: 'Medium',
        color: 'violet',
    },
    {
        id: 'scroll-depth-banner',
        name: 'Scroll Reward Banner',
        description: 'Show a banner when users read more than 70% of your page.',
        category: 'Retention',
        icon: Scroll,
        difficulty: 'Easy',
        color: 'emerald',
    },
    {
        id: 'time-on-page-notification',
        name: 'Help Notification',
        description: 'Offer support after a visitor spends too much time on a page.',
        category: 'Support',
        icon: Bell,
        difficulty: 'Easy',
        color: 'amber',
    },
    {
        id: 'pricing-web-hook',
        name: 'Pricing Lead Sync',
        description: 'Sync high-intent pricing page visits directly to your CRM via webhook.',
        category: 'Advanced',
        icon: Webhook,
        difficulty: 'Hard',
        color: 'rose',
    },
    {
        id: 'abandoned-cart-notification',
        name: 'Abandoned Cart Reminder',
        description: 'Remind users about their items if they stay idle on checkout.',
        category: 'E-commerce',
        icon: Tag,
        difficulty: 'Medium',
        color: 'cyan',
    },
];

const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', icon: 'text-blue-500' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', icon: 'text-violet-500' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', icon: 'text-emerald-500' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', icon: 'text-amber-500' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', icon: 'text-rose-500' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', icon: 'text-cyan-500' },
};

const difficultyColors: Record<string, string> = {
    Easy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    Medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    Hard: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

export default function TemplatesPage() {
    const params = useParams();
    const router = useRouter();
    const websiteId = params?.websiteId as string;

    const handleSelectTemplate = (templateId: string) => {
        router.push(`/websites/${websiteId}/automations/builder?template=${templateId}`);
    };

    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Back link */}
            <Link
                href={`/websites/${websiteId}/automations`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Automations
            </Link>

            <DashboardPageHeader
                title="Templates"
                description="Pre-built behavioral workflows to get started quickly."
            />

            {/* Template grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => {
                    const colors = colorMap[template.color] || colorMap.blue;
                    const Icon = template.icon;
                    return (
                        <Card
                            key={template.id}
                            className="group border border-border/60 bg-card shadow-sm hover:shadow-md transition-all duration-200 flex flex-col"
                        >
                            <CardContent className="p-5 flex flex-col flex-1">
                                <div className="flex items-start justify-between mb-3">
                                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', colors.bg)}>
                                        <Icon className={cn('h-5 w-5', colors.icon)} />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Badge variant="outline" className={cn('text-[10px] font-medium border', difficultyColors[template.difficulty])}>
                                            {template.difficulty}
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">
                                            {template.category}
                                        </Badge>
                                    </div>
                                </div>

                                <h3 className="text-sm font-semibold mb-1">{template.name}</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                                    {template.description}
                                </p>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSelectTemplate(template.id)}
                                    className="w-full mt-4 gap-1.5 text-xs font-medium h-8"
                                >
                                    Use Template
                                    <ChevronRight className="h-3 w-3" />
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Custom CTA */}
            <Card className="border border-border/60 bg-card shadow-sm">
                <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold">Need something custom?</h3>
                            <p className="text-xs text-muted-foreground">Build a workflow from scratch with the visual builder.</p>
                        </div>
                    </div>
                    <Link href={`/websites/${websiteId}/automations/builder`}>
                        <Button size="sm" className="gap-1.5 text-xs font-medium">
                            <Zap className="h-3.5 w-3.5" />
                            Start from Scratch
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
