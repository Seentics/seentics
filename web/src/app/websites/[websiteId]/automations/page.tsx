'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Workflow,
    Plus,
    Search,
    Zap,
    Mail,
    Bell,
    Globe,
    Database,
    Trash2,
    CheckCircle2,
    LayoutGrid,
    ExternalLink,
    EyeOff,
    MessageSquare,
    Megaphone,
    Code,
    Terminal,
    Power,
    PowerOff,
    MoreVertical,
    Eye,
    Edit,
    AlertCircle,
    Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/analytics-api';
import { useAutomations, useDeleteAutomation, useToggleAutomation, useBulkDeleteAutomations } from '@/lib/automations-api';
import { getWebsiteBySiteId } from '@/lib/websites-api';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';
import { DataTable, ColumnDef, SortableHeader, selectionColumn } from '@/components/ui/data-table';

const actionIcons: Record<string, any> = {
    email: Mail,
    webhook: Globe,
    slack: Bell,
    discord: Bell,
    notification: Bell,
    script: Code,
    banner: Megaphone,
    modal: MessageSquare,
    redirect: ExternalLink,
    hide_element: EyeOff,
    custom: Zap,
    default: Database,
};

export default function AutomationsPage() {
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

    const isAutomationDisabled = website && !website.automationEnabled;

    const { data, isLoading, error, refetch } = useAutomations(websiteId, pageSize, (page - 1) * pageSize);
    const deleteAutomation = useDeleteAutomation();
    const bulkDeleteAutomations = useBulkDeleteAutomations();
    const toggleAutomation = useToggleAutomation();

    const automations = data?.automations || [];
    const totalCount = data?.total || 0;

    const filteredAutomations = useMemo(() => {
        if (!searchTerm) return automations;
        return automations.filter(auto =>
            auto.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [automations, searchTerm]);

    const activeCount = useMemo(() => automations.filter(auto => auto.isActive).length, [automations]);
    const totalTriggers = useMemo(() => automations.reduce((sum, auto) => sum + (auto.stats?.last30Days || 0), 0), [automations]);
    const totalExecutions = useMemo(() => automations.reduce((sum, auto) => sum + (auto.stats?.totalExecutions || 0), 0), [automations]);

    const totalPages = Math.ceil(totalCount / pageSize);

    const handleSelectAll = (_checked: boolean) => {};  // handled by DataTable
    const handleSelectOne = (_id: string, _checked: boolean) => {}; // handled by DataTable

    const handleDelete = async (automationId: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
        try {
            await deleteAutomation.mutateAsync({ websiteId, automationId });
            toast({ title: "Deleted", description: `"${name}" has been removed.` });
            setSelectedIds(prev => prev.filter(id => id !== automationId));
        } catch {
            toast({ title: "Error", description: "Failed to delete automation.", variant: "destructive" });
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} automations?`)) return;
        try {
            await bulkDeleteAutomations.mutateAsync({ websiteId, automationIds: selectedIds });
            toast({ title: "Bulk Deleted", description: `${selectedIds.length} automations have been removed.` });
            setSelectedIds([]);
        } catch {
            toast({ title: "Error", description: "Failed to delete automations.", variant: "destructive" });
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

    const columns = useMemo((): ColumnDef<any>[] => [
        selectionColumn<any>(),
        {
            id: 'automation',
            header: 'Automation',
            cell: ({ row }) => {
                const auto = row.original;
                const ActionIcon = auto.actions?.length > 0 ? getActionIcon(auto.actions[0].actionType) : Zap;
                return (
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm', auto.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                            <ActionIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{auto.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-bold">{auto.triggerType?.replace('_', ' ')}</span>
                                <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />
                                <span className="text-[10px] text-muted-foreground/60">{new Date(auto.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                );
            },
        },
        {
            id: 'triggers',
            header: 'Triggers',
            size: 110,
            cell: ({ row }) => (
                <div className="text-center">
                    <span className="text-sm font-bold tabular-nums">{formatNumber(row.original.stats?.last30Days || 0)}</span>
                </div>
            ),
        },
        {
            id: 'actions_icons',
            header: 'Actions',
            size: 110,
            cell: ({ row }) => {
                const auto = row.original;
                return (
                    <div className="flex items-center justify-center -space-x-1.5">
                        {auto.actions?.length > 0 ? (
                            auto.actions.slice(0, 3).map((action: any, i: number) => {
                                const Icon = getActionIcon(action.actionType);
                                return (
                                    <div key={i} className="h-7 w-7 rounded-full border-2 border-background bg-secondary flex items-center justify-center shadow-md" style={{ zIndex: 10 - i }} title={action.actionType}>
                                        <Icon className="h-3 w-3 text-secondary-foreground" />
                                    </div>
                                );
                            })
                        ) : (
                            <span className="text-[10px] font-medium text-muted-foreground/40 bg-muted/50 px-1.5 py-0.5 rounded">None</span>
                        )}
                        {auto.actions?.length > 3 && (
                            <div className="h-7 w-7 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary z-0 shadow-sm">+{auto.actions.length - 3}</div>
                        )}
                    </div>
                );
            },
        },
        {
            id: 'success_rate',
            header: 'Success',
            size: 110,
            cell: ({ row }) => {
                const rate = row.original.stats?.successRate || 0;
                return (
                    <div className="flex flex-col items-center gap-1.5">
                        <span className={cn('text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-full', rate >= 95 ? 'bg-emerald-500/10 text-emerald-600' : rate >= 80 ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600')}>
                            {rate.toFixed(1)}%
                        </span>
                        <div className="h-1 w-12 bg-muted/60 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', rate >= 95 ? 'bg-emerald-500' : rate >= 80 ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${rate}%` }} />
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
                const auto = row.original;
                return (
                    <div className="flex items-center justify-center gap-2">
                        <div className={cn('h-2 w-2 rounded-full', auto.isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-muted-foreground/40')} />
                        <span className={cn('text-xs font-bold', auto.isActive ? 'text-emerald-500' : 'text-muted-foreground/60')}>
                            {auto.isActive ? 'ACTIVE' : 'PAUSED'}
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
                const auto = row.original;
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
                                    <Link href={`/websites/${websiteId}/automations/builder?id=${auto.id}`} className="flex items-center gap-3 w-full py-2.5 px-3">
                                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Edit className="h-4 w-4 text-blue-500" /></div>
                                        <div className="flex flex-col"><span className="text-xs font-semibold">Edit Workflow</span><span className="text-[10px] text-muted-foreground">Change logic or triggers</span></div>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggle(auto.id, auto.name, auto.isActive)} className="cursor-pointer rounded-md focus:bg-emerald-500/5">
                                    <div className="flex items-center gap-3 w-full py-2.5 px-3">
                                        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', auto.isActive ? 'bg-amber-500/10' : 'bg-emerald-500/10')}>
                                            {auto.isActive ? <PowerOff className="h-4 w-4 text-amber-500" /> : <Power className="h-4 w-4 text-emerald-500" />}
                                        </div>
                                        <div className="flex flex-col"><span className="text-xs font-semibold">{auto.isActive ? 'Pause Flow' : 'Start Flow'}</span></div>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1 bg-border/40" />
                                <DropdownMenuItem onClick={() => handleDelete(auto.id, auto.name)} className="cursor-pointer rounded-md focus:bg-rose-500/10 text-rose-500">
                                    <div className="flex items-center gap-3 w-full py-2.5 px-3">
                                        <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center"><Trash2 className="h-4 w-4" /></div>
                                        <div className="flex flex-col"><span className="text-xs font-semibold">Delete Workflow</span></div>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="sm" variant="secondary"
                            className="h-7 gap-1.5 px-2.5 text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-sm border border-primary/20"
                            onClick={() => router.push(`/websites/${websiteId}/automations/${auto.id}`)}>
                            <Eye className="h-3.5 w-3.5 fill-current" /> VIEW
                        </Button>
                    </div>
                );
            },
        },
    ], [websiteId, handleDelete, handleToggle, router, getActionIcon]);

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
                    <Button variant="outline" className="h-9 gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                        <LayoutGrid className="h-3.5 w-3.5" /> Templates
                    </Button>
                </Link>
                <Link href={`/websites/${websiteId}/automations/builder`}>
                    <Button className="h-9 gap-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all">
                        <Plus className="h-3.5 w-3.5" /> Create Automation
                    </Button>
                </Link>
            </DashboardPageHeader>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Total Automations" value={totalCount} icon={Database} description={`${activeCount} active currently`} color="blue" />
                <StatsCard title="Live Workflows" value={activeCount} icon={Zap} description="Executing in real-time" color="emerald" />
                <StatsCard title="30d Triggers" value={totalTriggers} icon={Activity} description="Matching events" color="violet" />
                <StatsCard title="Total Executions" value={totalExecutions} icon={CheckCircle2} description="Successful actions" color="amber" />
            </div>

            {/* Table */}
            <DataTable
                columns={columns}
                data={filteredAutomations}
                paginationMode="server"
                pageIndex={page - 1}
                pageCount={totalPages}
                pageSize={pageSize}
                totalRowCount={totalCount}
                onPaginationChange={({ pageIndex }) => setPage(pageIndex + 1)}
                enableRowSelection
                onRowSelectionChange={(rows) => setSelectedIds(rows.map((r: any) => r.id))}
                onRowClick={(row: any) => router.push(`/websites/${websiteId}/automations/${row.id}`)}
                emptyIcon={<Workflow className="h-6 w-6" />}
                emptyTitle={searchTerm ? 'No matching automations' : 'No automations yet'}
                emptyDescription={
                    searchTerm
                        ? `No automations matching "${searchTerm}"`
                        : 'Create your first automation to start engaging users automatically.'
                }
                emptyAction={
                    searchTerm ? (
                        <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => setSearchTerm('')}>Clear search</Button>
                    ) : (
                        <Link href={`/websites/${websiteId}/automations/builder`}>
                            <Button size="sm" className="gap-2 text-xs"><Plus className="h-3.5 w-3.5" /> Create Automation</Button>
                        </Link>
                    )
                }
                toolbarLeft={
                    <div>
                        <h3 className="text-base font-semibold">Automations</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{totalCount} total workflows</p>
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
                            placeholder="Search automations..."
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

function StatsCard({ title, value, icon: Icon, description, color = 'blue' }: any) {
    const bgMap: Record<string, string> = { blue: 'bg-blue-500/10', emerald: 'bg-emerald-500/10', violet: 'bg-violet-500/10', amber: 'bg-amber-500/10' };
    const iconMap: Record<string, string> = { blue: 'text-blue-500', emerald: 'text-emerald-500', violet: 'text-violet-500', amber: 'text-amber-500' };
    return (
        <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{title}</p>
                        <p className="text-2xl font-semibold tracking-tight">{typeof value === 'number' ? formatNumber(value) : value}</p>
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
