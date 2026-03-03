'use client';

import React, { useState, useMemo } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useFunnels, useDeleteFunnel, useUpdateFunnel, useBulkDeleteFunnels } from '@/lib/funnels-api';
import { getWebsiteBySiteId } from '@/lib/websites-api';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/analytics-api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';
import { DataTable, ColumnDef, SortableHeader, selectionColumn } from '@/components/ui/data-table';

export default function FunnelsPage() {
    const params = useParams();
    const router = useRouter();
    const websiteId = params?.websiteId as string;
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const { data: website } = useQuery({
        queryKey: ['website', websiteId],
        queryFn: () => getWebsiteBySiteId(websiteId),
        enabled: !!websiteId,
    });

    const isFunnelDisabled = website && !website.funnelEnabled;

    const { data, isLoading, error, refetch } = useFunnels(websiteId, pageSize, (page - 1) * pageSize);
    const deleteFunnel = useDeleteFunnel();
    const bulkDeleteFunnels = useBulkDeleteFunnels();
    const updateFunnel = useUpdateFunnel();

    const funnels = data?.funnels || [];
    const totalCount = data?.total || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    const filteredFunnels = useMemo(() => {
        if (!searchTerm) return funnels;
        return funnels.filter(funnel =>
            funnel.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [funnels, searchTerm]);

    const stats = useMemo(() => {
        const active = funnels.filter(f => f.isActive).length;
        const entries = funnels.reduce((acc, f) => acc + (f.stats?.totalEntries || 0), 0);
        const conversion = funnels.length > 0
            ? (funnels.reduce((acc, f) => acc + (f.stats?.conversionRate || 0), 0) / funnels.length).toFixed(1)
            : '0';
        return { active, entries, conversion };
    }, [funnels]);

    const handleSelectAll = (_checked: boolean) => {}; // handled by DataTable
    const handleSelectOne = (_id: string, _checked: boolean) => {}; // handled by DataTable

    const handleDelete = async (funnelId: string, name: string) => {
        if (!confirm(`Are you sure you want to delete funnel "${name}"?`)) return;

        try {
            await deleteFunnel.mutateAsync({ websiteId, funnelId });
            toast({
                title: 'Funnel Deleted',
                description: `"${name}" has been removed successfully.`,
            });
            setSelectedIds(prev => prev.filter(id => id !== funnelId));
        } catch {
            toast({
                title: 'Error',
                description: 'Failed to delete funnel. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} funnels?`)) return;

        try {
            await bulkDeleteFunnels.mutateAsync({ websiteId, funnelIds: selectedIds });
            toast({
                title: 'Funnels Deleted',
                description: `${selectedIds.length} funnels have been removed.`,
            });
            setSelectedIds([]);
        } catch {
            toast({
                title: 'Error',
                description: 'Failed to delete selected funnels.',
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

    const columns = useMemo((): ColumnDef<any>[] => [
        selectionColumn<any>(),
        {
            id: 'funnel',
            header: 'Funnel',
            cell: ({ row }) => {
                const funnel = row.original;
                return (
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm', funnel.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                            <Filter className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{funnel.name}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                Created {new Date(funnel.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                );
            },
        },
        {
            id: 'steps',
            header: 'Steps',
            size: 90,
            cell: ({ row }) => (
                <div className="text-center">
                    <span className="text-sm font-bold tabular-nums">{row.original.steps?.length || 0}</span>
                </div>
            ),
        },
        {
            id: 'entries',
            header: ({ column }) => <SortableHeader column={column}>Entries</SortableHeader>,
            accessorFn: (row) => row.stats?.totalEntries || 0,
            size: 110,
            cell: ({ row }) => (
                <div className="text-center">
                    <span className="text-sm font-bold tabular-nums">{formatNumber(row.original.stats?.totalEntries || 0)}</span>
                </div>
            ),
        },
        {
            id: 'conversion',
            header: ({ column }) => <SortableHeader column={column}>Conversion</SortableHeader>,
            accessorFn: (row) => row.stats?.conversionRate || 0,
            size: 110,
            cell: ({ row }) => {
                const rate = row.original.stats?.conversionRate || 0;
                return (
                    <div className="flex flex-col items-center gap-1.5">
                        <span className={cn('text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-full',
                            rate >= 30 ? 'bg-emerald-500/10 text-emerald-600' : rate >= 10 ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'
                        )}>
                            {rate.toFixed(1)}%
                        </span>
                        <div className="h-1 w-12 bg-muted/60 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', rate >= 30 ? 'bg-emerald-500' : rate >= 10 ? 'bg-amber-500' : 'bg-rose-500')}
                                style={{ width: `${Math.min(100, rate)}%` }} />
                        </div>
                    </div>
                );
            },
        },
        {
            id: 'status',
            header: 'Status',
            size: 100,
            cell: ({ row }) => {
                const funnel = row.original;
                return (
                    <div className="flex items-center justify-center gap-2">
                        <div className={cn('h-2 w-2 rounded-full', funnel.isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-muted-foreground/40')} />
                        <span className={cn('text-xs font-bold', funnel.isActive ? 'text-emerald-500' : 'text-muted-foreground/60')}>
                            {funnel.isActive ? 'ACTIVE' : 'PAUSED'}
                        </span>
                    </div>
                );
            },
        },
        {
            id: 'row_actions',
            header: '',
            size: 120,
            enableSorting: false,
            cell: ({ row }) => {
                const funnel = row.original;
                return (
                    <div className="flex items-center justify-end gap-1 pr-4" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-all hover:bg-muted">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 bg-card/98 backdrop-blur-xl border-border/40 shadow-2xl p-1">
                                <DropdownMenuItem asChild className="cursor-pointer rounded-md focus:bg-primary/5">
                                    <Link href={`/websites/${websiteId}/funnels/builder?id=${funnel.id}`} className="flex items-center gap-3 w-full py-2.5 px-3">
                                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Edit3 className="h-4 w-4 text-blue-500" /></div>
                                        <div className="flex flex-col"><span className="text-xs font-semibold">Edit Funnel</span><span className="text-[10px] text-muted-foreground">Modify steps</span></div>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleStatus(funnel)} className="cursor-pointer rounded-md focus:bg-emerald-500/5">
                                    <div className="flex items-center gap-3 w-full py-2.5 px-3">
                                        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', funnel.isActive ? 'bg-amber-500/10' : 'bg-emerald-500/10')}>
                                            {funnel.isActive ? <Pause className="h-4 w-4 text-amber-500" /> : <Play className="h-4 w-4 text-emerald-500" />}
                                        </div>
                                        <div className="flex flex-col"><span className="text-xs font-semibold">{funnel.isActive ? 'Pause Funnel' : 'Activate Funnel'}</span></div>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1 bg-border/40" />
                                <DropdownMenuItem onClick={() => handleDelete(funnel.id, funnel.name)} className="cursor-pointer rounded-md focus:bg-rose-500/10 text-rose-500">
                                    <div className="flex items-center gap-3 w-full py-2.5 px-3">
                                        <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center"><Trash2 className="h-4 w-4" /></div>
                                        <div className="flex flex-col"><span className="text-xs font-semibold">Delete Funnel</span></div>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="sm" variant="secondary"
                            className="h-7 gap-1.5 px-2.5 text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-sm border border-primary/20"
                            onClick={() => router.push(`/websites/${websiteId}/funnels/${funnel.id}`)}>
                            <Eye className="h-3.5 w-3.5 fill-current" /> VIEW
                        </Button>
                    </div>
                );
            },
        },
    ], [websiteId, handleDelete, handleToggleStatus, router]);

    if (isLoading) return <FunnelsSkeleton />;

    if (error) {
        return (
            <div className="p-6 md:p-8 max-w-[1400px] mx-auto flex flex-col items-center justify-center min-h-[60vh]">
                <div className="h-16 w-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-5">
                    <AlertCircle className="h-7 w-7 text-rose-500" />
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
                <StatsCard title="Total Funnels" value={totalCount} icon={Filter} description="All paths" color="blue" />
                <StatsCard title="Active" value={stats.active} icon={Target} description={`${totalCount > 0 ? ((stats.active / totalCount) * 100).toFixed(0) : 0}% operational`} color="emerald" />
                <StatsCard title="Total Entries" value={formatNumber(stats.entries)} icon={Users} description="Last 30 days" color="violet" />
                <StatsCard title="Avg. Conversion" value={`${stats.conversion}%`} icon={TrendingUp} description="Success rate" color="amber" />
            </div>

            {/* Table */}
            <DataTable
                columns={columns}
                data={filteredFunnels}
                paginationMode="server"
                pageIndex={page - 1}
                pageCount={totalPages}
                pageSize={pageSize}
                totalRowCount={totalCount}
                onPaginationChange={({ pageIndex }) => setPage(pageIndex + 1)}
                enableRowSelection
                onRowSelectionChange={(rows) => setSelectedIds(rows.map((r: any) => r.id))}
                onRowClick={(row: any) => router.push(`/websites/${websiteId}/funnels/${row.id}`)}
                emptyIcon={<Filter className="h-6 w-6" />}
                emptyTitle={searchTerm ? 'No matching funnels' : 'No funnels yet'}
                emptyDescription={
                    searchTerm
                        ? `No funnels matching "${searchTerm}"`
                        : 'Create your first funnel to start tracking user journeys.'
                }
                emptyAction={
                    searchTerm ? (
                        <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => setSearchTerm('')}>Clear search</Button>
                    ) : (
                        <Link href={`/websites/${websiteId}/funnels/builder`}>
                            <Button size="sm" className="gap-2 text-xs"><Plus className="h-3.5 w-3.5" /> Create Funnel</Button>
                        </Link>
                    )
                }
                toolbarLeft={
                    <div>
                        <h3 className="text-base font-semibold">Funnels</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{totalCount} total funnels</p>
                    </div>
                }
                selectionActions={(rows) => (
                    <>
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">{rows.length} selected</span>
                        <Button variant="destructive" size="sm" className="h-8 gap-2 text-xs shadow-sm" onClick={handleBulkDelete}>
                            <Trash2 className="h-3.5 w-3.5" /> Delete Selected
                        </Button>
                    </>
                )}
                toolbarRight={
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search funnels..."
                            className="pl-8 w-full md:w-[240px] h-9 text-sm bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                }
            />
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, description, color = 'blue' }: { title: string; value: string | number; icon: any; description: string; color?: string }) {
    const bgMap: Record<string, string> = { blue: 'bg-blue-500/10', emerald: 'bg-emerald-500/10', violet: 'bg-violet-500/10', amber: 'bg-amber-500/10' };
    const iconMap: Record<string, string> = { blue: 'text-blue-500', emerald: 'text-emerald-500', violet: 'text-violet-500', amber: 'text-amber-500' };
    return (
        <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{title}</p>
                        <p className="text-2xl font-semibold tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                        <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <div className={cn('shrink-0 h-9 w-9 rounded-lg flex items-center justify-center', bgMap[color])}>
                        <Icon className={cn('h-4 w-4', iconMap[color])} />
                    </div>
                </div>
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
            <Card className="border border-border/60">
                <div className="px-5 py-4 border-b border-border/40">
                    <Skeleton className="h-5 w-32" />
                </div>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="px-5 py-4 border-b border-border/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-lg" />
                            <div className="space-y-1.5"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div>
                        </div>
                        <Skeleton className="h-4 w-12" />
                    </div>
                ))}
            </Card>
        </div>
    );
}
