'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, TrendingDown, Users, Target, Clock, ChevronRight, BarChart3, Calendar, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FunnelStats, FunnelStep, useFunnels } from '@/lib/funnels-api';
import { formatNumber } from '@/lib/analytics-api';
import { DashboardPageHeader } from '@/components/dashboard-header';

export default function FunnelDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const websiteId = params?.websiteId as string;
    const funnelId = params?.funnelId as string;

    const { data, isLoading } = useFunnels(websiteId);
    const funnel = data?.funnels?.find(f => f.id === funnelId);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (!funnel) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Target className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Funnel Not Found</h2>
                <p className="text-muted-foreground mb-6">This funnel doesn't exist or has been deleted.</p>
                <Button onClick={() => router.push(`/websites/${websiteId}/funnels`)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Funnels
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
        <div className="min-h-screen bg-background">
            <div className="container max-w-7xl mx-auto py-8 px-4 space-y-6">
            {/* Header */}
            <DashboardPageHeader
                title={funnel.name}
                description={funnel.description || 'Conversion funnel analytics'}
            >
                <Button variant="outline" onClick={() => router.push(`/websites/${websiteId}/funnels`)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Funnels
                </Button>
                <Button onClick={() => router.push(`/websites/${websiteId}/funnels/builder?id=${funnelId}`)}>
                    Edit Funnel
                </Button>
            </DashboardPageHeader>

            {/* Status Badge */}
            <div className="flex items-center gap-3">
                <Badge
                    variant={funnel.isActive ? 'outline' : 'secondary'}
                    className={`rounded font-bold text-xs px-4 py-2 ${
                        funnel.isActive ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-slate-500/10 text-slate-500'
                    }`}
                >
                    <span className={`w-2 h-2 rounded-full mr-2 ${funnel.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                    {funnel.isActive ? 'Active' : 'Paused'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                    Created {new Date(funnel.createdAt).toLocaleDateString()}
                </span>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">Total Entries</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-black">{formatNumber(stats.totalEntries || 0)}</div>
                            <Users className="h-8 w-8 text-primary/30" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Visitors who started</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">Completions</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-black">{formatNumber(stats.completions || 0)}</div>
                            <Target className="h-8 w-8 text-green-500/30" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Reached final step</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">Conversion Rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-black">{(stats.conversionRate || 0).toFixed(1)}%</div>
                            <TrendingUp className="h-8 w-8 text-blue-500/30" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Success rate</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">Drop-off Rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-black">{dropoffRate.toFixed(1)}%</div>
                            <TrendingDown className="h-8 w-8 text-orange-500/30" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Lost visitors</p>
                    </CardContent>
                </Card>
            </div>

            {/* Funnel Visualization */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        Funnel Flow
                    </CardTitle>
                    <CardDescription>Step-by-step conversion breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {stepBreakdown.map((step, index) => {
                        const isLast = index === steps.length - 1;
                        const maxCount = stats.totalEntries || 1;
                        const widthPercent = (step.count / maxCount) * 100;

                        return (
                            <div key={step.stepOrder} className="space-y-3">
                                {/* Step Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="text-sm font-bold text-primary">{index + 1}</span>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold">{step.stepName}</h4>
                                            <p className="text-xs text-muted-foreground">
                                                {steps[index]?.stepType === 'page_view' ? steps[index]?.pagePath : steps[index]?.eventType}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-black">{formatNumber(step.count)}</div>
                                        <div className="text-xs text-muted-foreground">visitors</div>
                                    </div>
                                </div>

                                {/* Visual Bar */}
                                <div className="relative">
                                    <div className="h-12 bg-muted/30 rounded-lg overflow-hidden">
                                        <div
                                            className={`h-full flex items-center justify-between px-4 transition-all duration-1000 ${
                                                isLast ? 'bg-green-500' : 'bg-primary'
                                            }`}
                                            style={{ width: `${widthPercent}%` }}
                                        >
                                            <span className="text-sm font-bold text-white">
                                                {step.conversionRate.toFixed(1)}%
                                            </span>
                                            {step.count > 0 && (
                                                <span className="text-sm font-bold text-white/80">
                                                    {formatNumber(step.count)} users
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Drop-off Info */}
                                {!isLast && step.dropoffCount > 0 && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <TrendingDown className="h-4 w-4 text-orange-500" />
                                        <span className="text-muted-foreground">
                                            <span className="font-bold text-orange-600">{formatNumber(step.dropoffCount)}</span> visitors ({step.dropoffRate.toFixed(1)}%) dropped off
                                        </span>
                                    </div>
                                )}

                                {/* Arrow Connector */}
                                {!isLast && (
                                    <div className="flex justify-center py-2">
                                        <ChevronRight className="h-6 w-6 text-muted-foreground/30 rotate-90" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {/* Funnel Steps Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        Step Details
                    </CardTitle>
                    <CardDescription>Detailed breakdown of each funnel step</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Path/Event</th>
                                    <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Visitors</th>
                                    <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Conversion</th>
                                    <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Drop-off</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {steps.map((step, index) => {
                                    const stepStat = stepBreakdown[index];
                                    return (
                                        <tr key={step.id} className="hover:bg-muted/5">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <span className="text-xs font-bold text-primary">{index + 1}</span>
                                                    </div>
                                                    <span className="font-bold">{step.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <Badge variant="outline" className="text-xs">
                                                    {step.stepType === 'page_view' ? 'Page View' : 'Custom Event'}
                                                </Badge>
                                            </td>
                                            <td className="py-4 px-4 font-mono text-sm text-muted-foreground">
                                                {step.stepType === 'page_view' ? step.pagePath : step.eventType}
                                            </td>
                                            <td className="py-4 px-4 text-center font-bold">
                                                {formatNumber(stepStat?.count || 0)}
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className="font-bold text-primary">
                                                    {(stepStat?.conversionRate || 0).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className="font-bold text-orange-600">
                                                    {formatNumber(stepStat?.dropoffCount || 0)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
                </Card>
            </div>
        </div>
    );
}