'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    LayoutGrid, 
    Zap, 
    MousePointer2, 
    Clock, 
    Scroll, 
    ArrowLeft,
    Gift,
    UserCheck,
    Mail,
    Bell,
    Layers,
    Webhook,
    Tag,
    AlertCircle,
    ChevronRight,
    Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const templates = [
    {
        id: 'welcome-modal',
        name: 'Welcome Modal',
        description: 'Engage new visitors immediately with a personalized greeting modal.',
        category: 'Lead Gen',
        icon: UserCheck,
        difficulty: 'Easy',
        colorClass: 'bg-blue-500/10 text-blue-500'
    },
    {
        id: 'exit-intent-promotion',
        name: 'Exit Intent Discount',
        description: 'Capture abandoning users with a special offer just before they leave.',
        category: 'Sales',
        icon: Gift,
        difficulty: 'Medium',
        colorClass: 'bg-indigo-500/10 text-indigo-500'
    },
    {
        id: 'scroll-depth-banner',
        name: 'Scroll Reward Banner',
        description: 'Show a banner when users read more than 70% of your page.',
        category: 'Retention',
        icon: Scroll,
        difficulty: 'Easy',
        colorClass: 'bg-emerald-500/10 text-emerald-500'
    },
    {
        id: 'time-on-page-notification',
        name: 'Help Notification',
        description: 'Offer support after a visitor spends too much time on a page.',
        category: 'Support',
        icon: Bell,
        difficulty: 'Easy',
        colorClass: 'bg-amber-500/10 text-amber-500'
    },
    {
        id: 'pricing-web-hook',
        name: 'Pricing Lead Sync',
        description: 'Sync high-intent pricing page visits directly to your CRM via Webhook.',
        category: 'Advanced',
        icon: Webhook,
        difficulty: 'Hard',
        colorClass: 'bg-primary/10 text-primary'
    },
    {
        id: 'abandoned-cart-notification',
        name: 'Abandoned Cart Reminder',
        description: 'Remind users about their items if they stay idle on checkout.',
        category: 'E-commerce',
        icon: Tag,
        difficulty: 'Medium',
        colorClass: 'bg-rose-500/10 text-rose-500'
    }
];

export default function TemplatesPage() {
    const params = useParams();
    const router = useRouter();
    const websiteId = params?.websiteId as string;

    const handleSelectTemplate = (templateId: string) => {
        router.push(`/websites/${websiteId}/automations/builder?template=${templateId}`);
    };

    return (
        <div className="p-4 sm:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <Link 
                        href={`/websites/${websiteId}/automations`}
                        className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary uppercase tracking-widest transition-colors mb-2 group"
                    >
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Automations
                    </Link>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <LayoutGrid className="text-primary h-8 w-8" />
                        Automation Templates
                    </h1>
                    <p className="text-muted-foreground font-medium text-lg">
                        Jumpstart your growth with pre-built behavioral workflows.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Badge variant="secondary" className="px-4 py-1.5 rounded-full font-bold text-primary bg-primary/5 border-primary/10">
                        {templates.length} Ready-to-use Templates
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                    <Card key={template.id} className="group border shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl ${template.colorClass} group-hover:scale-110 transition-transform duration-300`}>
                                    <template.icon size={28} />
                                </div>
                                <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-wider rounded-md border-muted-foreground/20">
                                    {template.category}
                                </Badge>
                            </div>
                            <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-1">
                                {template.name}
                            </CardTitle>
                            <CardDescription className="text-sm font-medium leading-relaxed line-clamp-2 mt-2">
                                {template.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 pb-4">
                            <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                <div className="flex items-center gap-1.5">
                                    <Star size={12} className="text-yellow-500 fill-yellow-500" />
                                    {template.difficulty}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Zap size={12} className="text-primary fill-primary" />
                                    Instant Activate
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-0 pb-6 px-6">
                            <Button 
                                onClick={() => handleSelectTemplate(template.id)}
                                className="w-full h-11 bg-slate-950 hover:bg-primary text-white font-bold rounded gap-2 transition-all group/btn"
                            >
                                Use Template
                                <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {/* Empty State / Custom Info */}
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center md:text-left">
                    <h3 className="text-xl font-bold flex items-center justify-center md:justify-start gap-2">
                        <AlertCircle className="text-primary h-5 w-5" />
                        Need something unique?
                    </h3>
                    <p className="text-muted-foreground font-medium">
                        You can always start from scratch and build a completely custom workflow.
                    </p>
                </div>
                <Link href={`/websites/${websiteId}/automations/builder`}>
                    <Button variant="outline" className="h-12 px-8 font-black rounded gap-2 border-2 hover:bg-slate-50 dark:hover:bg-slate-900">
                        Start from Scratch
                    </Button>
                </Link>
            </div>
        </div>
    );
}
