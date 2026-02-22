'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Filter,
    Plus,
    Search,
    TrendingUp,
    Users,
    Trash2,
    MoreVertical,
    Eye,
    Edit3,
    Pause,
    Play,
    AlertCircle,
    RefreshCw,
    Target,
    BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useFunnels, useDeleteFunnel, useUpdateFunnel } from '@/lib/funnels-api';
import { getWebsiteBySiteId } from '@/lib/websites-api';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/analytics-api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';

export default function FunnelsPage() {
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

    const isFunnelDisabled = website && !website.funnelEnabled;

    const { data, isLoading, error, refetch } = useFunnels(websiteId);
    const deleteFunnel = useDeleteFunnel();
    const updateFunnel = useUpdateFunnel();

    const funnels = data?.funnels || [];
    const totalFunnels = funnels.length;
    const activeFunnels = funnels.filter(f => f.isActive).length;
    const totalEntries = funnels.reduce((acc, f) => acc + (f.stats?.totalEntries || 0), 0);
    const avgConversion = funnels.length > 0
        ? (funnels.reduce((acc, f) => acc + (f.stats?.conversionRate || 0), 0) / funnels.length).toFixed(1)
        : '0';

    const filteredFunnels = funnels.filter(funnel =>
        funnel.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = async (funnelId: string, name: string) => {
        if (!confirm(`Are you sure you want to delete funnel "${name}"?`)) return;

        try {
            await deleteFunnel.mutateAsync({ websiteId, funnelId });
            toast({
                title: 'Funnel Deleted',
                description: `"${name}" has been removed successfully.`,
            });
        } catch {
            toast({
                title: 'Error',
                description: 'Failed to delete funnel. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handleToggleStatus = async (funnel: any) => {
        try {
            await updateFunnel.mutateAsync({
                websiteId,
                funnelId: funnel.id,
                data: { isActive: !funnel.isActive },
            });
            toast({
                title: funnel.isActive ? 'Funnel Paused' : 'Funnel Activated',
                description: `"${funnel.name}" has been ${funnel.isActive ? 'paused' : 'activated'}.`,
            });
        } catch {
            toast({
                title: 'Error',
                description: 'Failed to update funnel status.',
                variant: 'destructive',
            });
        }
    };

    if (isLoading) return <FunnelsSkeleton />;

    if (error) {
        return (
            <div className="p-6 md:p-8 max-w-[1400px] mx-auto flex flex-col items-center justify-center min-h-[60vh]">
                <div className="h-16 w-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-5">
                    <AlertCircle className="h-7 w-7 text-rose-500/60" />
                </div>
                <h2 className="text-lg font-semibold mb-1.5">Failed to load funnels</h2>
                <p className="text-sm text-muted-foreground mb-5">Something went wrong while fetching your data.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 text-xs">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
            {isFunnelDisabled && (
                <Alert className="bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20">
                    <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle className="text-amber-700 dark:text-amber-400 font-medium text-sm">Tracking Disabled</AlertTitle>
                    <AlertDescription className="text-amber-600/80 dark:text-amber-400/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
                        <span>Funnel tracking is currently disabled. Enable it in settings to collect conversion data.</span>
                        <Link href={`/websites/${websiteId}/settings`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400">
                                Go to Settings
                            </Button>
                        </Link>
                    </AlertDescription>
                </Alert>
            )}

            <DashboardPageHeader
                title="Conversion Funnels"
                description="Track multi-step conversion paths and identify where users drop off."
            >
                <Link href={`/websites/${websiteId}/funnels/builder`}>
                    <Button size="sm" className="gap-1.5 text-xs font-medium">
                        <Plus className="h-3.5 w-3.5" />
                        Create Funnel
                    </Button>
                </Link>
            </DashboardPageHeader>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Total Funnels" value={totalFunnels} icon={Filter} description="All funnels" color="blue" />
                <StatsCard title="Active" value={activeFunnels} icon={Target} description={`${totalFunnels > 0 ? ((activeFunnels / totalFunnels) * 100).toFixed(0) : 0}% operational`} color="emerald" />
                <StatsCard title="Total Entries" value={formatNumber(totalEntries)} icon={Users} description="Last 30 days" color="violet" />
                <StatsCard title="Avg. Conversion" value={`${avgConversion}%`} icon={TrendingUp} description="Across all funnels" color="amber" />
            </div>

            {/* Table */}
            <Card className="border border-border/60 bg-card shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="px-5 py-4 border-b border-border/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-base font-semibold text-foreground">All Funnels</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {filteredFunnels.length} {filteredFunnels.length === 1 ? 'funnel' : 'funnels'}
                                {searchTerm && ` matching "${searchTerm}"`}
                            </p>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search funnels..."
                                className="pl-8 w-full sm:w-[240px] h-8 text-sm bg-muted/30 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {filteredFunnels.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-14 w-14 bg-muted/40 rounded-2xl flex items-center justify-center mb-4">
                            <Filter className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-sm font-semibold mb-1">
                            {searchTerm ? 'No results found' : 'No funnels yet'}
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            {searchTerm
                                ? `No funnels matching "${searchTerm}"`
                                : 'Create your first funnel to start tracking conversions.'}
                        </p>
                        {!searchTerm && (
                            <Link href={`/websites/${websiteId}/funnels/builder`}>
                                <Button size="sm" className="mt-4 gap-1.5 text-xs">
                                    <Plus className="h-3.5 w-3.5" />
                                    Create Funnel
                                </Button>
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Column headers */}
                        <div className="grid grid-cols-[1fr_70px_90px_100px_80px_110px] items-center px-5 py-2.5 border-b border-border/30 bg-muted/10 text-xs font-medium text-muted-foreground">
                            <div className="pl-1">Funnel</div>
                            <div className="text-center">Steps</div>
                            <div className="text-center">Entries</div>
                            <div className="text-center">Conversion</div>
                            <div className="text-center">Status</div>
                            <div />
                        </div>

                        {/* Rows */}
                        <div className="divide-y divide-border/20">
                            {filteredFunnels.map((funnel) => (
                                <div
                                    key={funnel.id}
                                    className="group grid grid-cols-[1fr_70px_90px_100px_80px_110px] items-center px-5 py-3 transition-colors cursor-pointer hover:bg-muted/20"
                                    onClick={() => router.push(`/websites/${websiteId}/funnels/${funnel.id}`)}
                                >
                                    {/* Funnel info */}
                                    <div className="flex items-center gap-3 min-w-0 pl-1">
                                        <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                                            <BarChart3 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{funnel.name}</p>
                                            <p className="text-xs text-muted-foreground/60 mt-0.5">
                                                Created {new Date(funnel.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Steps */}
                                    <div className="text-center">
                                        <span className="text-sm font-semibold tabular-nums">{(funnel.steps || []).length}</span>
                                    </div>

                                    {/* Entries */}
                                    <div className="text-center">
                                        <span className="text-sm font-semibold tabular-nums">{formatNumber(funnel.stats?.totalEntries || 0)}</span>
                                    </div>

                                    {/* Conversion */}
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-sm font-semibold tabular-nums text-primary">
                                            {funnel.stats?.conversionRate || 0}%
                                        </span>
                                        <div className="w-12 h-1 bg-muted/60 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary/70 rounded-full transition-all duration-700"
                                                style={{ width: `${funnel.stats?.conversionRate || 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div className="flex items-center justify-center gap-1.5">
                                        <span className={cn(
                                            'h-1.5 w-1.5 rounded-full',
                                            funnel.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'
                                        )} />
                                        <span className={cn(
                                            'text-xs font-medium',
                                            funnel.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                                        )}>
                                            {funnel.isActive ? 'Active' : 'Paused'}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-all">
                                                    <MoreVertical className="h-3.5 w-3.5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-44">
                                                <DropdownMenuItem
                                                    onClick={() => router.push(`/websites/${websiteId}/funnels/builder?id=${funnel.id}&mode=edit`)}
                                                    className="text-xs gap-2"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" /> Edit Funnel
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleToggleStatus(funnel)}
                                                    className="text-xs gap-2"
                                                >
                                                    {funnel.isActive ? (
                                                        <><Pause className="h-3.5 w-3.5" /> Pause</>
                                                    ) : (
                                                        <><Play className="h-3.5 w-3.5" /> Activate</>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => handleDelete(funnel.id, funnel.name)}
                                                    className="text-xs gap-2 text-rose-600 focus:text-rose-600"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10"
                                            onClick={() => router.push(`/websites/${websiteId}/funnels/${funnel.id}`)}
                                        >
                                            <Eye className="h-3.5 w-3.5" /> View
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, description, color = 'blue' }: { title: string; value: string | number; icon: any; description: string; color?: string }) {
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
                <div className="text-2xl font-semibold tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </CardContent>
        </Card>
    );
}

function FunnelsSkeleton() {
    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <Skeleton className="h-8 w-32" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
            <Skeleton className="h-64" />
        </div>
    );
}
