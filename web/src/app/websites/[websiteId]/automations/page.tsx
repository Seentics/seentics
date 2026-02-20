'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Workflow,
    Plus,
    Search,
    ArrowUpRight,
    Zap,
    Mail,
    Bell,
    Globe,
    Database,
    Loader2,
    Trash2,
    Power,
    PowerOff,
    MoreVertical,
    Eye,
    Edit,
    AlertCircle,
    Activity,
    CheckCircle2,
    XCircle,
    Clock,
    LayoutGrid,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { formatNumber } from '@/lib/analytics-api';
import { useAutomations, useDeleteAutomation, useToggleAutomation } from '@/lib/automations-api';
import { getWebsiteBySiteId } from '@/lib/websites-api';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';

const actionIcons: Record<string, any> = {
    email: Mail,
    webhook: Globe,
    slack: Bell,
    discord: Bell,
    custom: Zap,
    default: Database,
};

export default function AutomationsPage() {
    const params = useParams();
    const router = useRouter();
    const websiteId = params?.websiteId as string;
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');

    const { data: website } = useQuery({
        queryKey: ['website', websiteId],
        queryFn: () => getWebsiteBySiteId(websiteId),
        enabled: !!websiteId,
    });

    const isAutomationDisabled = website && !website.automationEnabled;

    const { data, isLoading, error, refetch } = useAutomations(websiteId);
    const deleteAutomation = useDeleteAutomation();
    const toggleAutomation = useToggleAutomation();

    const automations = data?.automations || [];

    const filteredAutomations = automations.filter(auto =>
        auto.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalAutomations = automations.length;
    const activeCount = automations.filter(auto => auto.isActive).length;
    const totalTriggers = automations.reduce((sum, auto) => sum + (auto.stats?.last30Days || 0), 0);
    const totalExecutions = automations.reduce((sum, auto) => sum + (auto.stats?.totalExecutions || 0), 0);
    const pausedCount = totalAutomations - activeCount;

    const handleDelete = async (automationId: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
        try {
            await deleteAutomation.mutateAsync({ websiteId, automationId });
            toast({ title: "Deleted", description: `"${name}" has been removed.` });
        } catch {
            toast({ title: "Error", description: "Failed to delete automation.", variant: "destructive" });
        }
    };

    const handleToggle = async (automationId: string, name: string, currentStatus: boolean) => {
        try {
            await toggleAutomation.mutateAsync({ websiteId, automationId });
            toast({ title: currentStatus ? "Paused" : "Activated", description: `"${name}" is now ${currentStatus ? 'paused' : 'active'}.` });
        } catch {
            toast({ title: "Error", description: "Failed to toggle automation.", variant: "destructive" });
        }
    };

    const getActionIcon = (actionType: string) => actionIcons[actionType] || actionIcons.default;

    if (isLoading) return <AutomationsSkeleton />;

    if (error) {
        return (
            <div className="p-6 md:p-8 min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4 max-w-[1400px] mx-auto">
                <div className="h-16 w-16 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                    <AlertCircle className="h-7 w-7 text-rose-500" />
                </div>
                <div className="max-w-md space-y-1.5">
                    <h2 className="text-lg font-semibold">Something went wrong</h2>
                    <p className="text-sm text-muted-foreground">We couldn't load your automations. This might be a temporary issue.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 text-xs">
                    <Activity className="h-3.5 w-3.5" /> Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
            {isAutomationDisabled && (
                <Alert className="bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20">
                    <Zap className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-700 dark:text-amber-500 font-semibold">Scripts Disabled</AlertTitle>
                    <AlertDescription className="text-amber-600/80 dark:text-muted-foreground/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <span>Automation scripts are disabled for this website. Workflows won't execute until re-enabled.</span>
                        <Link href={`/websites/${websiteId}/settings`}>
                            <Button size="sm" variant="outline" className="border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-500/10 gap-2 text-xs font-medium">
                                <Activity className="h-3.5 w-3.5" /> Open Settings
                            </Button>
                        </Link>
                    </AlertDescription>
                </Alert>
            )}

            <DashboardPageHeader
                title="Automations"
                description="Create automated workflows based on user interactions and events."
                icon={Workflow}
            >
                <Link href={`/websites/${websiteId}/automations/templates`}>
                    <Button variant="outline" className="h-9 gap-2 text-xs font-medium">
                        <LayoutGrid className="h-3.5 w-3.5" /> Templates
                    </Button>
                </Link>
                <Link href={`/websites/${websiteId}/automations/builder`}>
                    <Button className="h-9 gap-2 text-xs font-medium">
                        <Plus className="h-3.5 w-3.5" /> Create Automation
                    </Button>
                </Link>
            </DashboardPageHeader>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Total Automations" value={totalAutomations} icon={Database} description={`${activeCount} active, ${pausedCount} paused`} color="blue" />
                <StatsCard title="Live Workflows" value={activeCount} icon={Zap} description="Currently active" color="emerald" />
                <StatsCard title="30d Triggers" value={totalTriggers} icon={Activity} description="Events matched" color="violet" />
                <StatsCard title="Total Executions" value={totalExecutions} icon={CheckCircle2} description="Actions performed" color="amber" />
            </div>

            {/* Table */}
            <Card className="border border-border/60 bg-card shadow-sm overflow-hidden">
                <CardHeader className="border-b border-border/40 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg font-semibold">Workflows</CardTitle>
                            <CardDescription className="text-sm mt-0.5">Manage and track automation performance</CardDescription>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search automations..."
                                className="pl-8 w-full md:w-[260px] h-8 text-sm bg-muted/30 border-border/50"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredAutomations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                            <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-5">
                                <Workflow className="h-7 w-7 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-base font-semibold">
                                {searchTerm ? 'No matching automations' : 'No automations yet'}
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1.5">
                                {searchTerm
                                    ? `No automations matching "${searchTerm}"`
                                    : 'Create your first automation to start engaging users automatically.'}
                            </p>
                            {searchTerm ? (
                                <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={() => setSearchTerm('')}>Clear search</Button>
                            ) : (
                                <Link href={`/websites/${websiteId}/automations/builder`} className="mt-4">
                                    <Button size="sm" className="gap-2 text-xs">
                                        <Plus className="h-3.5 w-3.5" /> Create Automation
                                    </Button>
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-border/40 bg-muted/20">
                                        <TableHead className="px-5 py-3 text-xs font-medium text-muted-foreground">Automation</TableHead>
                                        <TableHead className="py-3 text-xs font-medium text-muted-foreground text-center">Triggers (30d)</TableHead>
                                        <TableHead className="py-3 text-xs font-medium text-muted-foreground text-center">Actions</TableHead>
                                        <TableHead className="py-3 text-xs font-medium text-muted-foreground text-center">Success Rate</TableHead>
                                        <TableHead className="py-3 text-xs font-medium text-muted-foreground text-center">Status</TableHead>
                                        <TableHead className="px-5 py-3 w-[60px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAutomations.map((auto) => {
                                        const ActionIcon = auto.actions?.length > 0
                                            ? getActionIcon(auto.actions[0].actionType)
                                            : Zap;
                                        const successRate = auto.stats?.successRate || 0;

                                        return (
                                            <TableRow
                                                key={auto.id}
                                                className="group hover:bg-muted/30 transition-colors cursor-pointer border-border/30"
                                                onClick={() => router.push(`/websites/${websiteId}/automations/${auto.id}`)}
                                            >
                                                <TableCell className="px-5 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                                                            <ActionIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium group-hover:text-primary transition-colors truncate max-w-[280px]">{auto.name}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-xs text-muted-foreground">{auto.triggerType.replace('_', ' ')}</span>
                                                                <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />
                                                                <span className="text-xs text-muted-foreground">{new Date(auto.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3.5 text-center">
                                                    <span className="text-sm font-semibold tabular-nums">{formatNumber(auto.stats?.last30Days || 0)}</span>
                                                </TableCell>
                                                <TableCell className="py-3.5">
                                                    <div className="flex items-center justify-center -space-x-1.5">
                                                        {auto.actions?.map((action, i) => {
                                                            const Icon = getActionIcon(action.actionType);
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className="h-7 w-7 rounded-full border-2 border-card bg-muted flex items-center justify-center"
                                                                    title={action.actionType}
                                                                >
                                                                    <Icon className="h-3 w-3 text-muted-foreground" />
                                                                </div>
                                                            );
                                                        })}
                                                        {(!auto.actions || auto.actions.length === 0) && (
                                                            <span className="text-xs text-muted-foreground/50">None</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3.5">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        <span className={cn("text-xs font-semibold tabular-nums", successRate >= 95 ? 'text-emerald-600 dark:text-emerald-400' : successRate >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400')}>
                                                            {successRate.toFixed(1)}%
                                                        </span>
                                                        <div className="h-1 w-14 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className={cn("h-full rounded-full transition-all", successRate >= 95 ? 'bg-emerald-500/70' : successRate >= 80 ? 'bg-amber-500/70' : 'bg-rose-500/70')}
                                                                style={{ width: `${successRate}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3.5 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <span className={cn("h-1.5 w-1.5 rounded-full", auto.isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30")} />
                                                        <span className={cn("text-xs", auto.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                                                            {auto.isActive ? 'Active' : 'Paused'}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <MoreVertical className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-44">
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/websites/${websiteId}/automations/${auto.id}`} className="gap-2 text-xs">
                                                                    <Eye className="h-3.5 w-3.5" /> View Details
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/websites/${websiteId}/automations/builder?id=${auto.id}`} className="gap-2 text-xs">
                                                                    <Edit className="h-3.5 w-3.5" /> Edit Workflow
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleToggle(auto.id, auto.name, auto.isActive)} className="gap-2 text-xs">
                                                                {auto.isActive ? <><PowerOff className="h-3.5 w-3.5" /> Pause</> : <><Power className="h-3.5 w-3.5" /> Activate</>}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleDelete(auto.id, auto.name)} className="gap-2 text-xs text-rose-600 focus:text-rose-600">
                                                                <Trash2 className="h-3.5 w-3.5" /> Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, description, color = 'blue' }: any) {
    const accentMap: Record<string, string> = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', violet: 'bg-violet-500', amber: 'bg-amber-500' };
    const iconMap: Record<string, string> = { blue: 'text-blue-500', emerald: 'text-emerald-500', violet: 'text-violet-500', amber: 'text-amber-500' };
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
                <div className="text-2xl font-semibold tracking-tight">{typeof value === 'number' ? formatNumber(value) : value}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </CardContent>
        </Card>
    );
}

function AutomationsSkeleton() {
    return (
        <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-9 w-40" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i} className="border border-border/60 p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-4 w-4" />
                        </div>
                        <Skeleton className="h-7 w-16" />
                        <Skeleton className="h-3 w-32" />
                    </Card>
                ))}
            </div>
            <Card className="border border-border/60">
                <CardHeader className="border-b border-border/40 pb-4">
                    <div className="flex justify-between">
                        <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-48" /></div>
                        <Skeleton className="h-8 w-60" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-9 w-9 rounded-lg" />
                                <div className="space-y-1.5"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div>
                            </div>
                            <Skeleton className="h-4 w-12" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
