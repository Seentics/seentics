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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
            <Card className="border border-border/60 bg-card shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <CardTitle className="text-base font-semibold">All Funnels</CardTitle>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search funnels..."
                                className="pl-9 h-8 text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredFunnels.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="h-12 w-12 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Filter className="h-5 w-5 text-muted-foreground/40" />
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
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-xs font-medium">Funnel</TableHead>
                                    <TableHead className="text-xs font-medium text-center">Steps</TableHead>
                                    <TableHead className="text-xs font-medium text-center">Entries</TableHead>
                                    <TableHead className="text-xs font-medium text-center">Conversion</TableHead>
                                    <TableHead className="text-xs font-medium text-center">Status</TableHead>
                                    <TableHead className="text-xs font-medium w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredFunnels.map((funnel) => (
                                    <TableRow
                                        key={funnel.id}
                                        className="group cursor-pointer"
                                        onClick={() => router.push(`/websites/${websiteId}/funnels/${funnel.id}`)}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                    <BarChart3 className="h-4 w-4 text-primary" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{funnel.name}</p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        Created {new Date(funnel.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-sm font-medium">{(funnel.steps || []).length}</span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-sm font-medium">{formatNumber(funnel.stats?.totalEntries || 0)}</span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-sm font-medium text-primary">
                                                    {funnel.stats?.conversionRate || 0}%
                                                </span>
                                                <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary/70 rounded-full transition-all duration-700"
                                                        style={{ width: `${funnel.stats?.conversionRate || 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="inline-flex items-center gap-1.5">
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
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MoreVertical className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-44">
                                                    <DropdownMenuItem
                                                        onClick={() => router.push(`/websites/${websiteId}/funnels/${funnel.id}`)}
                                                        className="text-xs gap-2"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" /> View Details
                                                    </DropdownMenuItem>
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
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
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
