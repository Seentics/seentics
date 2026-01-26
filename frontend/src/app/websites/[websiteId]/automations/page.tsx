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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/analytics-api';
import { useAutomations, useDeleteAutomation, useToggleAutomation } from '@/lib/automations-api';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

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

    // Fetch automations from API
    const { data, isLoading, error } = useAutomations(websiteId);
    const deleteAutomation = useDeleteAutomation();
    const toggleAutomation = useToggleAutomation();

    const automations = data?.automations || [];

    const filteredAutomations = automations.filter(auto =>
        auto.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calculate stats from real data
    const totalTriggers = automations.reduce((sum, auto) => sum + (auto.stats?.last30Days || 0), 0);
    const avgSuccessRate = automations.length > 0
        ? automations.reduce((sum, auto) => sum + (auto.stats?.successRate || 0), 0) / automations.length
        : 0;
    const activeCount = automations.filter(auto => auto.isActive).length;
    const pausedCount = automations.filter(auto => !auto.isActive).length;

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
        return (
            <div className="p-4 sm:p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 sm:p-6">
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl p-6 text-center">
                    <p className="text-red-600 dark:text-red-400">Failed to load automations. Please try again.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1280px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Workflow Automations</h1>
                    <p className="text-muted-foreground font-medium">Manage and monitor your automated intelligence workflows.</p>
                </div>
                <Link href={`/websites/${websiteId}/automations/builder`}>
                    <Button variant="brand" className="h-12 px-6 font-black rounded-2xl gap-2 shadow-xl shadow-primary/20">
                        <Plus className="h-5 w-5" />
                        Create Automation
                    </Button>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-card dark:bg-gray-800 rounded-md overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold text-[10px] uppercase tracking-widest">Total Triggers (30d)</CardDescription>
                        <CardTitle className="text-3xl font-black">{formatNumber(totalTriggers)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-[11px] font-black text-green-500 bg-green-500/10 w-fit px-2 py-0.5 rounded-full">
                            <ArrowUpRight size={12} />
                            Live Data
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-muted-foreground/10 bg-background/50 backdrop-blur-sm rounded-[2rem] overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold text-[10px] uppercase tracking-widest">Average Success Rate</CardDescription>
                        <CardTitle className="text-3xl font-black text-blue-600">{avgSuccessRate.toFixed(1)}%</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-[11px] font-black text-blue-500 bg-blue-500/10 w-fit px-2 py-0.5 rounded-full">
                            {avgSuccessRate >= 95 ? 'Excellent' : avgSuccessRate >= 80 ? 'Good' : 'Needs Attention'}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-muted-foreground/10 bg-background/50 backdrop-blur-sm rounded-[2rem] overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold text-[10px] uppercase tracking-widest">Active Workflows</CardDescription>
                        <CardTitle className="text-3xl font-black">{activeCount}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-[11px] font-black text-amber-500 bg-amber-500/10 w-fit px-2 py-0.5 rounded-full">
                            {pausedCount > 0 ? `${pausedCount} Paused` : 'All Active'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Filter */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                    placeholder="Search automations by name..."
                    className="pl-12 h-14 bg-muted/20 border-none shadow-none focus-visible:ring-1 text-sm font-medium rounded-2xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Automations Table */}
            {filteredAutomations.length === 0 ? (
                <div className="border rounded-[2.5rem] overflow-hidden bg-card dark:bg-gray-800 border-muted-foreground/10 shadow-sm p-12 text-center">
                    <Workflow className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-bold mb-2">No Automations Yet</h3>
                    <p className="text-muted-foreground mb-6">Create your first automation to get started</p>
                    <Link href={`/websites/${websiteId}/automations/builder`}>
                        <Button variant="brand" className="h-12 px-6 font-black rounded-2xl gap-2">
                            <Plus className="h-5 w-5" />
                            Create Your First Automation
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-card dark:bg-gray-800 rounded-md overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/30 border-b border-muted-foreground/10">
                                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Automation</th>
                                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">30d Triggers</th>
                                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Success Rate</th>
                                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Status</th>
                                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-muted-foreground/5">
                            {filteredAutomations.map((auto) => {
                                const ActionIcon = auto.actions && auto.actions.length > 0
                                    ? getActionIcon(auto.actions[0].actionType)
                                    : Zap;
                                const actionType = auto.actions && auto.actions.length > 0
                                    ? auto.actions[0].actionType
                                    : 'automation';

                                return (
                                    <tr key={auto.id} className="hover:bg-muted/5 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-border/50 flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                                                    <ActionIcon className="h-6 w-6 text-primary" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{auto.name}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                                        {actionType} • {auto.triggerType}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center font-black text-base text-slate-900 dark:text-white">
                                            {formatNumber(auto.stats?.last30Days || 0)}
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <span className={`text-sm font-black ${(auto.stats?.successRate || 0) > 95 ? 'text-green-500' : 'text-amber-500'}`}>
                                                    {(auto.stats?.successRate || 0).toFixed(1)}%
                                                </span>
                                                <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${(auto.stats?.successRate || 0) > 95 ? 'bg-green-500' : 'bg-amber-500'}`}
                                                        style={{ width: `${auto.stats?.successRate || 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <Badge
                                                variant={auto.isActive ? 'outline' : 'secondary'}
                                                className={`rounded-lg font-black text-[10px] uppercase tracking-widest border-0 ${auto.isActive ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-500'
                                                    }`}
                                            >
                                                {auto.isActive ? 'active' : 'paused'}
                                            </Badge>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-9 w-9 p-0 rounded-xl hover:bg-muted"
                                                    onClick={() => handleToggle(auto.id, auto.name, auto.isActive)}
                                                    title={auto.isActive ? "Pause" : "Activate"}
                                                >
                                                    {auto.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-9 w-9 p-0 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500"
                                                    onClick={() => handleDelete(auto.id, auto.name)}
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <Link href={`/websites/${websiteId}/automations/${auto.id}`}>
                                                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-muted">
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Promo Section */}
            <div className="bg-primary/5 rounded-[2.5rem] p-10 border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="space-y-4 text-center md:text-left">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto md:mx-0">
                        <Workflow size={28} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">Unlock more power</h3>
                    <p className="text-muted-foreground font-medium max-w-lg">
                        Combine custom events with multiple actions for complex chaining. Seentics Automation is the ultimate growth tool for your intelligence engine.
                    </p>
                </div>
                <Button variant="brand" className="h-14 px-10 rounded-2xl font-black text-base shadow-2xl shadow-primary/20">
                    View Mastery Guide
                </Button>
            </div>
        </div>
    );
}
