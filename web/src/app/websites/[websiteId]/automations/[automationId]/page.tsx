'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Zap, TrendingUp, Activity, Clock, CheckCircle2, XCircle, Mail, MessageSquare, Bell, Webhook, Code, Eye, AlertTriangle, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutomations, AutomationStats } from '@/lib/automations-api';
import { formatNumber } from '@/lib/analytics-api';
import { DashboardPageHeader } from '@/components/dashboard-header';

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
            <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (!automation) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Zap className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Automation Not Found</h2>
                <p className="text-muted-foreground mb-6">This automation doesn't exist or has been deleted.</p>
                <Button onClick={() => router.push(`/websites/${websiteId}/automations`)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Automations
                </Button>
            </div>
        );
    }

    const stats: AutomationStats = automation.stats ?? {
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        last30Days: 0,
    };
    const totalExecutions = stats.totalExecutions;
    const successCount = stats.successCount;
    const failureCount = stats.failureCount;
    const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;
    const failureRate = totalExecutions > 0 ? (failureCount / totalExecutions) * 100 : 0;

    const ActionIcon = automation.actions && automation.actions.length > 0
        ? actionIcons[automation.actions[0].actionType] || actionIcons.default
        : actionIcons.default;

    return (
        <div className="min-h-screen bg-background">
            <div className="container max-w-7xl mx-auto py-8 px-4 space-y-6">
            {/* Header */}
            <DashboardPageHeader
                title={automation.name}
                description={`${automation.triggerType.replace('_', ' ')} automation workflow`}
            >
                <Button variant="outline" onClick={() => router.push(`/websites/${websiteId}/automations`)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Automations
                </Button>
                <Button onClick={() => router.push(`/websites/${websiteId}/automations/builder?id=${automationId}`)}>
                    Edit Workflow
                </Button>
            </DashboardPageHeader>

            {/* Status Badge */}
            <div className="flex items-center gap-3">
                <Badge
                    variant={automation.isActive ? 'outline' : 'secondary'}
                    className={`rounded font-bold text-xs px-4 py-2 ${
                        automation.isActive ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-slate-500/10 text-slate-500'
                    }`}
                >
                    <span className={`w-2 h-2 rounded-full mr-2 ${automation.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                    {automation.isActive ? 'Active' : 'Paused'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                    Created {new Date(automation.createdAt).toLocaleDateString()}
                </span>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">Total Executions</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-black">{formatNumber(totalExecutions)}</div>
                            <Activity className="h-8 w-8 text-primary/30" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">All time</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">Successful</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-black">{formatNumber(successCount)}</div>
                            <CheckCircle2 className="h-8 w-8 text-green-500/30" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Executed successfully</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">Failed</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-black">{formatNumber(failureCount)}</div>
                            <XCircle className="h-8 w-8 text-red-500/30" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Execution errors</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">Success Rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-black">{successRate.toFixed(1)}%</div>
                            <TrendingUp className="h-8 w-8 text-blue-500/30" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Performance metric</p>
                    </CardContent>
                </Card>
            </div>

            {/* Trigger Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                        Trigger Configuration
                    </CardTitle>
                    <CardDescription>When this automation is triggered</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Activity className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold mb-1">
                                {automation.triggerType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                {automation.triggerType === 'page_view' && 'Triggers when a user views a specific page'}
                                {automation.triggerType === 'time_on_page' && 'Triggers when a user spends time on a page'}
                                {automation.triggerType === 'scroll_depth' && 'Triggers when a user scrolls to a specific depth'}
                                {automation.triggerType === 'exit_intent' && 'Triggers when a user is about to leave the page'}
                                {automation.triggerType === 'custom_event' && 'Triggers on a custom event'}
                                {automation.triggerType === 'form_submission' && 'Triggers when a form is submitted'}
                            </p>
                            {automation.triggerConfig?.targetUrl && (
                                <div className="mt-2">
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {automation.triggerConfig.targetUrl}
                                    </Badge>
                                </div>
                            )}
                            {automation.triggerConfig?.thresholdValue && (
                                <div className="mt-2">
                                    <span className="text-xs font-bold text-muted-foreground">
                                        Threshold: <span className="text-primary">{automation.triggerConfig.thresholdValue}</span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        Actions ({automation.actions?.length || 0})
                    </CardTitle>
                    <CardDescription>What happens when this automation triggers</CardDescription>
                </CardHeader>
                <CardContent>
                    {!automation.actions || automation.actions.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                            <p className="font-medium">No actions configured</p>
                            <p className="text-sm mt-1">Add actions to make this automation functional</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {automation.actions.map((action, index) => {
                                const Icon = actionIcons[action.actionType] || actionIcons.default;
                                return (
                                    <div key={index} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/5 transition-colors">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <span className="text-sm font-bold text-primary">{index + 1}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icon className="h-4 w-4 text-primary" />
                                                <h4 className="font-bold">
                                                    {action.actionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </h4>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {action.actionType === 'email' && 'Sends an email notification'}
                                                {action.actionType === 'modal' && 'Displays a modal popup to the user'}
                                                {action.actionType === 'banner' && 'Shows a banner message'}
                                                {action.actionType === 'notification' && 'Sends a browser notification'}
                                                {action.actionType === 'webhook' && 'Triggers a webhook URL'}
                                                {action.actionType === 'script' && 'Executes custom JavaScript code'}
                                                {action.actionType === 'redirect' && 'Redirects user to another page'}
                                                {action.actionType === 'hide_element' && 'Hides a page element'}
                                            </p>
                                            {action.actionConfig && Object.keys(action.actionConfig).length > 0 && (
                                                <div className="mt-3 p-3 bg-muted/30 rounded text-xs font-mono">
                                                    <pre className="overflow-x-auto">
                                                        {JSON.stringify(action.actionConfig, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Performance Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Performance Overview
                    </CardTitle>
                    <CardDescription>Execution success and failure rates</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* Success Rate Bar */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold">Success Rate</span>
                                <span className="text-sm font-bold text-green-600">{successRate.toFixed(1)}%</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all duration-1000"
                                    style={{ width: `${successRate}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {formatNumber(successCount)} of {formatNumber(totalExecutions)} executions successful
                            </p>
                        </div>

                        {/* Failure Rate Bar */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold">Failure Rate</span>
                                <span className="text-sm font-bold text-red-600">{failureRate.toFixed(1)}%</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-red-500 transition-all duration-1000"
                                    style={{ width: `${failureRate}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {formatNumber(failureCount)} of {formatNumber(totalExecutions)} executions failed
                            </p>
                        </div>
                    </div>
                </CardContent>
                </Card>
            </div>
        </div>
    );
}