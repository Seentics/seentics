'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Workflow,
    Plus,
    Search,
    ArrowUpRight,
    ArrowRight,
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
    LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/analytics-api';
import { useAutomations, useDeleteAutomation, useToggleAutomation } from '@/lib/automations-api';
import { getWebsiteBySiteId } from '@/lib/websites-api';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard-header';

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

    // Fetch automations from API
    const { data, isLoading, error, refetch } = useAutomations(websiteId);
    const deleteAutomation = useDeleteAutomation();
    const toggleAutomation = useToggleAutomation();

    const automations = data?.automations || [];

    const filteredAutomations = automations.filter(auto =>
        auto.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calculate stats from real data
    const totalAutomations = automations.length;
    const activeCount = automations.filter(auto => auto.isActive).length;
    const totalTriggers = automations.reduce((sum, auto) => sum + (auto.stats?.last30Days || 0), 0);
    const totalExecutions = automations.reduce((sum, auto) => sum + (auto.stats?.totalExecutions || 0), 0);
    const pausedCount = totalAutomations - activeCount;

    const handleDelete = async (automationId: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

        try {
            await deleteAutomation.mutateAsync({ websiteId, automationId });
            toast({
                title: "Automation Deleted",
                description: `"${name}" has been deleted successfully.`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete automation. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handleToggle = async (automationId: string, name: string, currentStatus: boolean) => {
        try {
            await toggleAutomation.mutateAsync({ websiteId, automationId });
            toast({
                title: currentStatus ? "Automation Paused" : "Automation Activated",
                description: `"${name}" is now ${currentStatus ? 'paused' : 'active'}.`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to toggle automation. Please try again.",
                variant: "destructive",
            });
        }
    };

    const getActionIcon = (actionType: string) => {
        const Icon = actionIcons[actionType] || actionIcons.default;
        return Icon;
    };

    if (isLoading) {
        return <AutomationsSkeleton />;
    }

    if (error) {
        return (
            <div className="p-4 sm:p-6 min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center">
                    <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
                <div className="max-w-md space-y-2">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Something went wrong</h2>
                    <p className="text-muted-foreground font-medium">
                        We couldn't load your automations. This might be a temporary connection issue.
                    </p>
                </div>
                <Button variant="outline" onClick={() => refetch()} className="h-11 px-8 rounded font-bold gap-2">
                    <Activity className="h-4 w-4" />
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto">
            {isAutomationDisabled && (
                <Alert className="bg-amber-500/10 border-amber-500/20">
                    <Zap className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-600 font-bold">Scripts Disabled</AlertTitle>
                    <AlertDescription className="text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <span>The automation script is currently disabled for this website. Your workflows will not execute on your site. Update your settings to re-enable them.</span>
                        <Link href={`/websites/${websiteId}/settings`}>
                            <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 gap-2">
                                <Activity className="h-3.5 w-3.5" />
                                Go to Settings
                            </Button>
                        </Link>
                    </AlertDescription>
                </Alert>
            )}

            <DashboardPageHeader
                title="Automations"
                description="Create powerful automated workflows based on user interactions and events."
            >

                <div className="flex items-center gap-3">
                    <Link href={`/websites/${websiteId}/automations/templates`}>
                        <Button variant="outline" className="h-12 px-6 font-black rounded gap-2 border-2 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                            <LayoutGrid className="h-5 w-5" />
                            Templates
                        </Button>
                    </Link>
                    <Link href={`/websites/${websiteId}/automations/builder`}>
                        <Button variant="brand" className="h-12 px-6 font-black rounded gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
                            <Plus className="h-5 w-5" />
                            Create Automation
                        </Button>
                    </Link>
                </div>
            </DashboardPageHeader>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatsCard 
                    title="Total Automations" 
                    value={totalAutomations} 
                    icon={Database} 
                    description={`${activeCount} Active, ${pausedCount} Paused`}
                    color="primary"
                />
                <StatsCard 
                    title="Live Workflows" 
                    value={activeCount} 
                    icon={Zap} 
                    description="Triggering in real-time"
                    color="green"
                />
                <StatsCard 
                    title="30d Triggers" 
                    value={totalTriggers} 
                    icon={Activity} 
                    description="Total events matched"
                    color="blue"
                />
                <StatsCard 
                    title="Total Executions" 
                    value={totalExecutions} 
                    icon={CheckCircle2} 
                    description="Actions performed"
                    color="purple"
                />
            </div>

            {/* Content Section */}
            <Card className="border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-card/50 dark:bg-card/50 rounded overflow-hidden dark:border-none backdrop-blur-sm">
                <CardHeader className="border-b border-muted-foreground/5 bg-muted/20 px-6 py-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg font-black">All Automation Workflows</CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-widest mt-1">Manage and track performance</CardDescription>
                        </div>
                        <div className="relative w-full md:w-80 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="Search by name..."
                                className="pl-12 h-11 bg-background border-muted-foreground/10 focus-visible:ring-1 text-sm font-medium rounded transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredAutomations.length === 0 ? (
                        <div className="py-24 text-center">
                            <div className="w-20 h-20 rounded bg-muted/30 flex items-center justify-center mx-auto mb-6">
                                <Search className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">No results found</h3>
                            <p className="text-muted-foreground font-medium max-w-sm mx-auto">
                                {searchTerm 
                                    ? `We couldn't find any automations matching "${searchTerm}"`
                                    : "You haven't created any automations for this website yet."}
                            </p>
                            {searchTerm && (
                                <Button variant="ghost" className="mt-4 font-bold" onClick={() => setSearchTerm('')}>
                                    Clear Search
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-muted-foreground/5">
                                        <th className="px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Automation</th>
                                        <th className="px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Triggers (30d)</th>
                                        <th className="px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Actions</th>
                                        <th className="px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Avg Rate</th>
                                        <th className="px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Status</th>
                                        <th className="px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-muted-foreground/5">
                                    {filteredAutomations.map((auto) => {
                                        const ActionIcon = auto.actions && auto.actions.length > 0
                                            ? getActionIcon(auto.actions[0].actionType)
                                            : Zap;
                                        
                                        const successRate = auto.stats?.successRate || 0;

                                        return (
                                            <tr key={auto.id} className="hover:bg-muted/10 transition-colors group">
                                                <td className="px-6 py-6 min-w-[300px]">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded bg-card dark:bg-card/50 border border-border flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                                            <ActionIcon className="h-6 w-6 text-primary" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{auto.name}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                    {auto.triggerType.replace('_', ' ')}
                                                                </span>
                                                                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                    Created {new Date(auto.createdAt).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-center font-black text-slate-900 dark:text-white">
                                                    {formatNumber(auto.stats?.last30Days || 0)}
                                                </td>
                                                <td className="px-6 py-6">
                                                    <div className="flex items-center justify-center -space-x-2">
                                                        {auto.actions?.map((action, i) => {
                                                            const Icon = getActionIcon(action.actionType);
                                                            return (
                                                                <div 
                                                                    key={i} 
                                                                    className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center shadow-sm"
                                                                    title={action.actionType}
                                                                >
                                                                    <Icon className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                                                                </div>
                                                            );
                                                        })}
                                                        {(!auto.actions || auto.actions.length === 0) && (
                                                            <span className="text-[10px] font-bold text-muted-foreground italic">No actions</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 min-w-[140px]">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <span className={`text-xs font-black ${successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-amber-500' : 'text-red-500'}`}>
                                                            {successRate.toFixed(1)}%
                                                        </span>
                                                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full transition-all duration-1000 ${successRate >= 95 ? 'bg-green-500' : successRate >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                                style={{ width: `${successRate}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-center">
                                                    <Badge
                                                        variant={auto.isActive ? 'outline' : 'secondary'}
                                                        className={`rounded font-black text-[10px] px-3 py-1 uppercase tracking-widest border-0 ${auto.isActive ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-500'
                                                            }`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${auto.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                                                        {auto.isActive ? 'active' : 'paused'}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-6 text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded hover:bg-muted">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48 rounded p-2 border-muted-foreground/10 shadow-xl">
                                                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 mb-1">Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/websites/${websiteId}/automations/${auto.id}`} className="flex items-center gap-2 px-3 py-2 cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-300">
                                                                    <Eye className="h-4 w-4" /> View Details
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/websites/${websiteId}/automations/builder?id=${auto.id}`} className="flex items-center gap-2 px-3 py-2 cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-300">
                                                                    <Edit className="h-4 w-4" /> Edit Workflow
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem 
                                                                onClick={() => handleToggle(auto.id, auto.name, auto.isActive)}
                                                                className="flex items-center gap-2 px-3 py-2 cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-300"
                                                            >
                                                                {auto.isActive ? (
                                                                    <>
                                                                        <PowerOff className="h-4 w-4" /> Pause
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Power className="h-4 w-4" /> Activate
                                                                    </>
                                                                )}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator className="bg-muted-foreground/5" />
                                                            <DropdownMenuItem 
                                                                onClick={() => handleDelete(auto.id, auto.name)}
                                                                className="flex items-center gap-2 px-3 py-2 cursor-pointer font-bold text-sm text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/30"
                                                            >
                                                                <Trash2 className="h-4 w-4" /> Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, description, color = 'primary' }: any) {
    const colorClasses: Record<string, string> = {
        primary: 'text-primary bg-primary/10',
        green: 'text-green-500 bg-green-500/10',
        blue: 'text-blue-500 bg-blue-500/10',
        purple: 'text-purple-500 bg-purple-500/10',
    };

    return (
        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-card dark:bg-gray-800/50 rounded overflow-hidden border border-muted-foreground/5 flex flex-col justify-between">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardDescription className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">{title}</CardDescription>
                    <div className={`p-2 rounded ${colorClasses[color]}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
                <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                    {typeof value === 'number' ? formatNumber(value) : value}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold text-muted-foreground">{description}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function AutomationsSkeleton() {
    return (
        <div className="p-4 sm:p-6 space-y-8 max-w-[1400px] mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-10 w-48 rounded" />
                    <Skeleton className="h-4 w-72 rounded" />
                </div>
                <Skeleton className="h-12 w-48 rounded" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i} className="border-none shadow-sm rounded overflow-hidden p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-8 w-8 rounded" />
                        </div>
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-32" />
                    </Card>
                ))}
            </div>

            <Card className="border-none shadow-sm rounded overflow-hidden">
                <CardHeader className="border-b border-muted-foreground/5 bg-muted/20 px-6 py-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                        <Skeleton className="h-11 w-full md:w-80 rounded" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="space-y-0 text-center">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="px-6 py-6 border-b border-muted-foreground/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-12 w-12 rounded" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-40" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                </div>
                                <Skeleton className="hidden md:block h-6 w-12" />
                                <Skeleton className="hidden md:block h-8 w-24 rounded-full" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-9 w-9 rounded" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
