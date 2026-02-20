'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Zap, TrendingUp, Activity, CheckCircle2, XCircle, Mail, MessageSquare, Bell, Webhook, Code, AlertTriangle, EyeOff, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutomations, AutomationStats } from '@/lib/automations-api';
import { formatNumber } from '@/lib/analytics-api';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const actionIcons: Record<string, any> = {
    email: Mail,
    modal: MessageSquare,
    banner: AlertTriangle,
    notification: Bell,
    webhook: Webhook,
    script: Code,
    redirect: ArrowLeft,
    hide_element: EyeOff,
    default: Zap,
};

export default function AutomationDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const websiteId = params?.websiteId as string;
    const automationId = params?.automationId as string;

    const { data, isLoading } = useAutomations(websiteId);
    const automation = data?.automations?.find(a => a.id === automationId);

    if (isLoading) {
        return (
            <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
                </div>
                <Skeleton className="h-48" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (!automation) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
                <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-5">
                    <Zap className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <h2 className="text-lg font-semibold mb-1.5">Automation Not Found</h2>
                <p className="text-sm text-muted-foreground mb-5">This automation doesn't exist or has been deleted.</p>
                <Button variant="outline" size="sm" onClick={() => router.push(`/websites/${websiteId}/automations`)} className="gap-2 text-xs">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Automations
                </Button>
            </div>
        );
    }

    const stats: AutomationStats = automation.stats ?? {
        totalExecutions: 0, successCount: 0, failureCount: 0, successRate: 0, last30Days: 0,
    };
    const totalExecutions = stats.totalExecutions;
    const successCount = stats.successCount;
    const failureCount = stats.failureCount;
    const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;
    const failureRate = totalExecutions > 0 ? (failureCount / totalExecutions) * 100 : 0;

    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/websites/${websiteId}/automations`)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-xl font-semibold">{automation.name}</h1>
                            <div className="flex items-center gap-1.5">
                                <span className={cn("h-1.5 w-1.5 rounded-full", automation.isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30")} />
                                <span className={cn("text-xs font-medium", automation.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                                    {automation.isActive ? 'Active' : 'Paused'}
                                </span>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {automation.triggerType.replace('_', ' ')} · Created {new Date(automation.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <Link href={`/websites/${websiteId}/automations/builder?id=${automationId}`}>
                    <Button size="sm" className="gap-2 text-xs font-medium">
                        <Edit className="h-3.5 w-3.5" /> Edit Workflow
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <DetailStatsCard title="Total Executions" value={formatNumber(totalExecutions)} icon={Activity} color="blue" description="All time" />
                <DetailStatsCard title="Successful" value={formatNumber(successCount)} icon={CheckCircle2} color="emerald" description="Executed successfully" />
                <DetailStatsCard title="Failed" value={formatNumber(failureCount)} icon={XCircle} color="rose" description="Execution errors" />
                <DetailStatsCard title="Success Rate" value={`${successRate.toFixed(1)}%`} icon={TrendingUp} color="violet" description="Performance metric" />
            </div>

            {/* Trigger Configuration */}
            <Card className="border border-border/60 bg-card shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base font-semibold">Trigger</CardTitle>
                    </div>
                    <CardDescription className="text-sm">What starts this automation</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-start gap-3 p-3.5 bg-muted/30 rounded-lg border border-border/40">
                        <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                            <Activity className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-medium">
                                {automation.triggerType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {automation.triggerType === 'page_view' && 'Triggers when a user views a specific page'}
                                {automation.triggerType === 'time_on_page' && 'Triggers after a user spends time on a page'}
                                {automation.triggerType === 'scroll_depth' && 'Triggers when a user scrolls to a specific depth'}
                                {automation.triggerType === 'exit_intent' && 'Triggers when a user is about to leave'}
                                {automation.triggerType === 'custom_event' && 'Triggers on a custom event'}
                                {automation.triggerType === 'form_submission' && 'Triggers when a form is submitted'}
                            </p>
                            {automation.triggerConfig?.targetUrl && (
                                <Badge variant="outline" className="mt-2 font-mono text-[10px]">{automation.triggerConfig.targetUrl}</Badge>
                            )}
                            {automation.triggerConfig?.thresholdValue && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Threshold: <span className="text-primary font-medium">{automation.triggerConfig.thresholdValue}</span>
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            <Card className="border border-border/60 bg-card shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base font-semibold">Actions ({automation.actions?.length || 0})</CardTitle>
                    </div>
                    <CardDescription className="text-sm">What happens when this automation triggers</CardDescription>
                </CardHeader>
                <CardContent>
                    {!automation.actions || automation.actions.length === 0 ? (
                        <div className="py-10 text-center">
                            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">No actions configured</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {automation.actions.map((action, index) => {
                                const Icon = actionIcons[action.actionType] || actionIcons.default;
                                return (
                                    <div key={index} className="flex items-start gap-3 p-3.5 border border-border/40 rounded-lg hover:bg-muted/20 transition-colors">
                                        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{index + 1}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <Icon className="h-3.5 w-3.5 text-primary" />
                                                <h4 className="text-sm font-medium">
                                                    {action.actionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </h4>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {action.actionType === 'email' && 'Sends an email notification'}
                                                {action.actionType === 'modal' && 'Displays a modal popup'}
                                                {action.actionType === 'banner' && 'Shows a banner message'}
                                                {action.actionType === 'notification' && 'Sends a browser notification'}
                                                {action.actionType === 'webhook' && 'Triggers a webhook URL'}
                                                {action.actionType === 'script' && 'Executes custom JavaScript'}
                                                {action.actionType === 'redirect' && 'Redirects user to another page'}
                                                {action.actionType === 'hide_element' && 'Hides a page element'}
                                            </p>
                                            {action.actionConfig && Object.keys(action.actionConfig).length > 0 && (
                                                <pre className="mt-2 p-2.5 bg-muted/30 rounded text-[11px] font-mono text-muted-foreground overflow-x-auto border border-border/30">
                                                    {JSON.stringify(action.actionConfig, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Performance */}
            <Card className="border border-border/60 bg-card shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base font-semibold">Performance</CardTitle>
                    </div>
                    <CardDescription className="text-sm">Execution success and failure rates</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Success Rate</span>
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{successRate.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500/70 rounded-full transition-all duration-700" style={{ width: `${successRate}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">{formatNumber(successCount)} of {formatNumber(totalExecutions)} successful</p>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Failure Rate</span>
                            <span className="text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums">{failureRate.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500/70 rounded-full transition-all duration-700" style={{ width: `${failureRate}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">{formatNumber(failureCount)} of {formatNumber(totalExecutions)} failed</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function DetailStatsCard({ title, value, icon: Icon, description, color }: { title: string; value: string; icon: any; description: string; color: string }) {
    const accentMap: Record<string, string> = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500', violet: 'bg-violet-500' };
    const iconMap: Record<string, string> = { blue: 'text-blue-500', emerald: 'text-emerald-500', rose: 'text-rose-500', violet: 'text-violet-500' };
    return (
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-sm">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentMap[color]}`} />
            <CardHeader className="pb-1 pl-5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{title}</span>
                    <Icon className={cn("h-4 w-4", iconMap[color])} />
                </div>
            </CardHeader>
            <CardContent className="pl-5 pt-0">
                <div className="text-2xl font-semibold tracking-tight">{value}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </CardContent>
        </Card>
    );
}
