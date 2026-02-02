'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    Zap, 
    Clock, 
    MousePointer2, 
    Layout, 
    Info,
    AlertTriangle,
    CheckCircle2,
    Activity
} from 'lucide-react';
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';

interface WebVital {
    name: string;
    avg: number;
    count: number;
    p75: number;
    p90: number;
    p99: number;
}

interface WebVitalsChartProps {
    data: WebVital[];
    isLoading?: boolean;
}

export function WebVitalsChart({ data, isLoading }: WebVitalsChartProps) {
    const getVitalConfig = (name: string) => {
        switch (name.toLowerCase()) {
            case 'lcp':
                return {
                    label: 'Largest Contentful Paint',
                    unit: 's',
                    multiplier: 0.001,
                    thresholds: { good: 2.5, neutral: 4.0 },
                    description: 'Measures loading performance. How fast the main content loads.'
                };
            case 'fid':
                return {
                    label: 'First Input Delay',
                    unit: 'ms',
                    multiplier: 1,
                    thresholds: { good: 100, neutral: 300 },
                    description: 'Measures interactivity. How fast the page responds to clicks.'
                };
            case 'cls':
                return {
                    label: 'Cumulative Layout Shift',
                    unit: '',
                    multiplier: 1,
                    thresholds: { good: 0.1, neutral: 0.25 },
                    description: 'Measures visual stability. Do elements jump around?'
                };
            case 'inp':
                return {
                    label: 'Interaction to Next Paint',
                    unit: 'ms',
                    multiplier: 1,
                    thresholds: { good: 200, neutral: 500 },
                    description: 'Measures overall responsiveness to all interactions.'
                };
            case 'ttfb':
                return {
                    label: 'Time to First Byte',
                    unit: 'ms',
                    multiplier: 1,
                    thresholds: { good: 800, neutral: 1800 },
                    description: 'Measures server response time.'
                };
            default:
                return {
                    label: name.toUpperCase(),
                    unit: '',
                    multiplier: 1,
                    thresholds: { good: 0, neutral: 0 },
                    description: ''
                };
        }
    };

    const getStatus = (value: number, thresholds: { good: number, neutral: number }) => {
        if (value <= thresholds.good) return 'good';
        if (value <= thresholds.neutral) return 'neutral';
        return 'poor';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'good': return 'text-emerald-500 bg-emerald-500/10 fill-emerald-500';
            case 'neutral': return 'text-amber-500 bg-amber-500/10 fill-amber-500';
            case 'poor': return 'text-rose-500 bg-rose-500/10 fill-rose-500';
            default: return 'text-slate-400';
        }
    };

    if (isLoading) {
        return (
            <Card className="border-border/40 shadow-sm col-span-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary animate-pulse" />
                        Core Web Vitals
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-40 bg-muted/20 animate-pulse rounded" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data || data.length === 0) {
        return (
            <Card className="border-border/40 shadow-sm col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <Zap className="h-12 w-12 text-slate-200 mb-4" />
                    <p className="text-slate-500 font-medium">No performance data yet.</p>
                    <p className="text-xs text-slate-400 mt-1 text-center max-w-xs">
                        Web Vitals are collected as users interact with your site. Make sure you've installed the tracker.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/40 shadow-sm bg-card col-span-full">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                        Core Web Vitals (P75)
                    </CardTitle>
                    <CardDescription className="text-xs font-medium">
                        User experience snapshots from real browser interactions.
                    </CardDescription>
                </div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Info className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px] text-[11px]">
                            Google uses the 75th percentile (P75) to determine if a site meets the experience thresholds.
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {data.map((vital) => {
                        const config = getVitalConfig(vital.name);
                        const val = vital.p75 * config.multiplier;
                        const status = getStatus(val, config.thresholds);
                        const colorClass = getStatusColor(status);

                        return (
                            <div key={vital.name} className="flex flex-col p-4 rounded-xl bg-accent/5 border border-border/40 hover:border-primary/20 transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{vital.name}</span>
                                    {status === 'good' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                    {status === 'neutral' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                                    {status === 'poor' && <AlertTriangle className="h-4 w-4 text-rose-500" />}
                                </div>

                                <div className="flex items-baseline gap-1 mb-1">
                                    <span className={cn("text-3xl font-black", colorClass.split(' ')[0])}>
                                        {config.unit === '' ? val.toFixed(2) : val.toFixed(2)}
                                    </span>
                                    <span className="text-xs font-bold text-muted-foreground">{config.unit}</span>
                                </div>
                                <p className="text-[11px] font-bold text-foreground/80 mb-4 h-8 line-clamp-2">
                                    {config.label}
                                </p>

                                <div className="space-y-1.5 mt-auto">
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter">
                                        <span className="text-emerald-500">Good</span>
                                        <span className="text-amber-500">Needs Imp.</span>
                                        <span className="text-rose-500">Poor</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden">
                                        <div 
                                            className="h-full bg-emerald-500" 
                                            style={{ width: `${Math.min(100, (config.thresholds.good / val) * 100)}%` }} 
                                        />
                                    </div>
                                    <p className="text-[9px] text-muted-foreground italic leading-tight mt-2">
                                        {config.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
