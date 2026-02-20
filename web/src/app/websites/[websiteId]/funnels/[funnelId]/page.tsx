'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, TrendingDown, Users, Target, ChevronDown, Activity, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { FunnelStats, FunnelStep, useFunnels } from '@/lib/funnels-api';
import { formatNumber } from '@/lib/analytics-api';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function FunnelDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const websiteId = params?.websiteId as string;
    const funnelId = params?.funnelId as string;

    const { data, isLoading } = useFunnels(websiteId);
    const funnel = data?.funnels?.find(f => f.id === funnelId);

    if (isLoading) {
        return (
            <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (!funnel) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
                <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-5">
                    <Target className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <h2 className="text-lg font-semibold mb-1.5">Funnel Not Found</h2>
                <p className="text-sm text-muted-foreground mb-5">This funnel doesn't exist or has been deleted.</p>
                <Button variant="outline" size="sm" onClick={() => router.push(`/websites/${websiteId}/funnels`)} className="gap-2 text-xs">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Funnels
                </Button>
            </div>
        );
    }

    const stats: FunnelStats = funnel.stats ?? {
        totalEntries: 0,
        completions: 0,
        conversionRate: 0,
        stepBreakdown: [],
    };
    const steps: FunnelStep[] = funnel.steps ?? [];
    const stepBreakdown = stats.stepBreakdown ?? [];
    const dropoffRate = 100 - stats.conversionRate;

    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/websites/${websiteId}/funnels`)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-xl font-semibold">{funnel.name}</h1>
                            <div className="flex items-center gap-1.5">
                                <span className={cn('h-1.5 w-1.5 rounded-full', funnel.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30')} />
                                <span className={cn('text-xs font-medium', funnel.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                                    {funnel.isActive ? 'Active' : 'Paused'}
                                </span>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {funnel.description || 'Conversion funnel'} · Created {new Date(funnel.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <Link href={`/websites/${websiteId}/funnels/builder?id=${funnelId}`}>
                    <Button size="sm" className="gap-2 text-xs font-medium">
                        <Edit className="h-3.5 w-3.5" /> Edit Funnel
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <DetailStatsCard title="Total Entries" value={formatNumber(stats.totalEntries || 0)} icon={Users} color="blue" description="Visitors who started" />
                <DetailStatsCard title="Completions" value={formatNumber(stats.completions || 0)} icon={Target} color="emerald" description="Reached final step" />
                <DetailStatsCard title="Conversion Rate" value={`${(stats.conversionRate || 0).toFixed(1)}%`} icon={TrendingUp} color="violet" description="Success rate" />
                <DetailStatsCard title="Drop-off Rate" value={`${dropoffRate.toFixed(1)}%`} icon={TrendingDown} color="amber" description="Lost visitors" />
            </div>

            {/* Funnel Flow Visualization */}
            <Card className="border border-border/60 bg-card shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base font-semibold">Funnel Flow</CardTitle>
                    </div>
                    <CardDescription className="text-sm">Step-by-step conversion breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                    {stepBreakdown.length === 0 ? (
                        <div className="py-10 text-center">
                            <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">No conversion data yet</p>
                        </div>
                    ) : (
                        stepBreakdown.map((step, index) => {
                            const isLast = index === stepBreakdown.length - 1;
                            const maxCount = stats.totalEntries || 1;
                            const widthPercent = Math.max(2, (step.count / maxCount) * 100);

                            return (
                                <div key={step.stepOrder}>
                                    <div className="flex items-center gap-4 py-4">
                                        {/* Step number */}
                                        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-semibold text-primary">{index + 1}</span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div>
                                                    <h4 className="text-sm font-medium">{step.stepName}</h4>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {steps[index]?.stepType === 'page_view' ? steps[index]?.pagePath : steps[index]?.eventType}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-lg font-semibold tabular-nums">{formatNumber(step.count)}</span>
                                                    <p className="text-[11px] text-muted-foreground">visitors</p>
                                                </div>
                                            </div>

                                            {/* Bar */}
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        'h-full rounded-full transition-all duration-700',
                                                        isLast ? 'bg-emerald-500/70' : 'bg-primary/60'
                                                    )}
                                                    style={{ width: `${widthPercent}%` }}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-[11px] text-muted-foreground">
                                                    {step.conversionRate.toFixed(1)}% of total
                                                </span>
                                                {!isLast && step.dropoffCount > 0 && (
                                                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                                        {formatNumber(step.dropoffCount)} dropped ({step.dropoffRate.toFixed(1)}%)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Connector */}
                                    {!isLast && (
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 flex justify-center">
                                                <ChevronDown className="h-4 w-4 text-muted-foreground/30" />
                                            </div>
                                            <div className="flex-1 border-t border-dashed border-border/40" />
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>

            {/* Step Details Table */}
            <Card className="border border-border/60 bg-card shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base font-semibold">Step Details</CardTitle>
                    </div>
                    <CardDescription className="text-sm">Detailed breakdown of each funnel step</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-xs font-medium">Step</TableHead>
                                <TableHead className="text-xs font-medium">Type</TableHead>
                                <TableHead className="text-xs font-medium">Path / Event</TableHead>
                                <TableHead className="text-xs font-medium text-center">Visitors</TableHead>
                                <TableHead className="text-xs font-medium text-center">Conversion</TableHead>
                                <TableHead className="text-xs font-medium text-center">Drop-off</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {steps.map((step, index) => {
                                const stepStat = stepBreakdown[index];
                                return (
                                    <TableRow key={step.id || index}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                                                    <span className="text-[10px] font-semibold text-primary">{index + 1}</span>
                                                </div>
                                                <span className="text-sm font-medium">{step.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-muted-foreground">
                                                {step.stepType === 'page_view' ? 'Page View' : 'Event'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-xs text-muted-foreground font-mono">
                                                {step.stepType === 'page_view' ? step.pagePath : step.eventType}
                                            </code>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-sm font-medium">{formatNumber(stepStat?.count || 0)}</span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-sm font-medium text-primary">{(stepStat?.conversionRate || 0).toFixed(1)}%</span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{formatNumber(stepStat?.dropoffCount || 0)}</span>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function DetailStatsCard({ title, value, icon: Icon, description, color }: { title: string; value: string; icon: any; description: string; color: string }) {
    const accentMap: Record<string, string> = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', violet: 'bg-violet-500', amber: 'bg-amber-500' };
    const iconMap: Record<string, string> = { blue: 'text-blue-500', emerald: 'text-emerald-500', violet: 'text-violet-500', amber: 'text-amber-500' };
    return (
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-sm">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentMap[color]}`} />
            <CardHeader className="pb-1 pl-5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{title}</span>
                    <Icon className={cn('h-4 w-4', iconMap[color])} />
                </div>
            </CardHeader>
            <CardContent className="pl-5 pt-0">
                <div className="text-2xl font-semibold tracking-tight">{value}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </CardContent>
        </Card>
    );
}
