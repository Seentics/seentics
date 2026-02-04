'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Filter,
    Plus,
    Search,
    ArrowRight,
    TrendingUp,
    BarChart3,
    Users,
    Trash2,
    Loader2,
    MoreVertical,
    Eye,
    Edit3,
    Pause,
    Play,
    AlertCircle,
    RefreshCw,
    Calendar,
    ChevronRight,
    Target
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
import { useFunnels, useDeleteFunnel, useUpdateFunnel } from '@/lib/funnels-api';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/analytics-api';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard-header';

export default function FunnelsPage() {
    const params = useParams();
    const router = useRouter();
    const websiteId = params?.websiteId as string;
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');

    const { data, isLoading, error, refetch } = useFunnels(websiteId);
    const deleteFunnel = useDeleteFunnel();
    const updateFunnel = useUpdateFunnel();

    const funnels = data?.funnels || [];
    const totalFunnels = funnels.length;
    const activeFunnels = funnels.filter(f => f.isActive).length;
    const totalEntries = funnels.reduce((acc, f) => acc + (f.stats?.totalEntries || 0), 0);
    const avgConversion = funnels.length > 0 
        ? (funnels.reduce((acc, f) => acc + (f.stats?.conversionRate || 0), 0) / funnels.length).toFixed(1)
        : 0;

    const filteredFunnels = funnels.filter(funnel =>
        funnel.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = async (funnelId: string, name: string) => {
        if (!confirm(`Are you sure you want to delete funnel "${name}"?`)) return;

        try {
            await deleteFunnel.mutateAsync({ websiteId, funnelId });
            toast({
                title: "Funnel Deleted",
                description: `"${name}" has been removed successfully.`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete funnel. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handleToggleStatus = async (funnel: any) => {
        try {
            await updateFunnel.mutateAsync({
                websiteId,
                funnelId: funnel.id,
                data: { isActive: !funnel.isActive }
            });
            toast({
                title: funnel.isActive ? "Funnel Paused" : "Funnel Activated",
                description: `"${funnel.name}" has been ${funnel.isActive ? 'paused' : 'activated'}.`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update funnel status.",
                variant: "destructive",
            });
        }
    };

    if (isLoading) return <FunnelsSkeleton />;

    if (error) {
        return (
            <div className="p-4 sm:p-6 flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                    <AlertCircle size={32} />
                </div>
                <div className="text-center">
                    <h3 className="text-xl font-black italic uppercase tracking-tight">Signal Interrupted</h3>
                    <p className="text-muted-foreground font-medium">We couldn't retrieve your funnel networks.</p>
                </div>
                <Button variant="outline" onClick={() => refetch()} className="rounded font-bold gap-2">
                    <RefreshCw size={16} />
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px] mx-auto">
            <DashboardPageHeader 
                title="Funnels"
                description="Visualize and optimize multi-stage user journeys."
            >
                <Link href={`/websites/${websiteId}/funnels/builder`}>
                    <Button variant="brand" className="h-12 px-6 font-black rounded gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
                        <Plus className="h-5 w-5" />
                        Create Funnel
                    </Button>
                </Link>
            </DashboardPageHeader>

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatsCard 
                    title="Total Funnel Paths" 
                    value={totalFunnels} 
                    icon={Filter} 
                    description="Global Inventory"
                    color="primary" 
                />
                <StatsCard 
                    title="Active Networks" 
                    value={activeFunnels} 
                    icon={Target} 
                    description={`${((activeFunnels/totalFunnels)*100 || 0).toFixed(0)}% Operational`} 
                    color="green" 
                />
                <StatsCard 
                    title="Traffic Entries" 
                    value={formatNumber(totalEntries)} 
                    icon={Users} 
                    description="Last 30 Days" 
                    color="blue" 
                />
                <StatsCard 
                    title="Avg. Conversion" 
                    value={`${avgConversion}%`} 
                    icon={TrendingUp} 
                    description="Efficiency Score" 
                    color="purple" 
                />
            </div>

            {/* Content Section */}
            <Card className="border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-card/50 dark:bg-card/50 rounded overflow-hidden dark:border-none backdrop-blur-sm">
                <CardHeader className="border-b border-muted-foreground/5 bg-muted/20 px-6 py-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg font-black">All Funnels</CardTitle>
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
                    {filteredFunnels.length === 0 ? (
                        <div className="py-24 text-center">
                            <div className="w-20 h-20 rounded bg-muted/30 flex items-center justify-center mx-auto mb-6">
                                <Search className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">No results found</h3>
                            <p className="text-muted-foreground font-medium max-w-sm mx-auto">
                                {searchTerm 
                                    ? `We couldn't find any funnels matching "${searchTerm}"`
                                    : "You haven't created any funnels for this website yet."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-muted-foreground/5">
                                        <th className="px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Funnel</th>
                                        <th className="px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Depth</th>
                                        <th className="px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">30d Flux</th>
                                        <th className="px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Success Rate</th>
                                        <th className="px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Status</th>
                                        <th className="px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-muted-foreground/5">
                                    {filteredFunnels.map((funnel) => (
                                        <tr key={funnel.id} className="hover:bg-muted/10 transition-colors group">
                                            <td className="px-6 py-6 min-w-[300px]">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded bg-card dark:bg-card/50 border border-border flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                                        <BarChart3 className="h-6 w-6 text-primary" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{funnel.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                Created {new Date(funnel.createdAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-center font-black text-slate-900 dark:text-white">
                                                {(funnel.steps || []).length} Nodes
                                            </td>
                                            <td className="px-6 py-6 text-center font-black text-slate-900 dark:text-white">
                                                {formatNumber(funnel.stats?.totalEntries || 0)}
                                            </td>
                                            <td className="px-6 py-6 min-w-[140px]">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className={`text-xs font-black text-primary`}>
                                                        {funnel.stats?.conversionRate || 0}%
                                                    </span>
                                                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-1000 bg-primary`}
                                                            style={{ width: `${funnel.stats?.conversionRate || 0}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-center">
                                                <Badge
                                                    variant={funnel.isActive ? 'outline' : 'secondary'}
                                                    className={`rounded font-black text-[10px] px-3 py-1 uppercase tracking-widest border-0 ${funnel.isActive ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-500'
                                                        }`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full mr-2 ${funnel.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                                                    {funnel.isActive ? 'active' : 'idle'}
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
                                                        <DropdownMenuItem 
                                                            onClick={() => router.push(`/websites/${websiteId}/funnels/builder?id=${funnel.id}`)}
                                                            className="flex items-center gap-2 px-3 py-2 cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-300"
                                                        >
                                                            <Eye className="h-4 w-4" /> View Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem 
                                                            onClick={() => router.push(`/websites/${websiteId}/funnels/builder?id=${funnel.id}&mode=edit`)}
                                                            className="flex items-center gap-2 px-3 py-2 cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-300"
                                                        >
                                                            <Edit3 className="h-4 w-4" /> Edit Funnel
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem 
                                                            onClick={() => handleToggleStatus(funnel)}
                                                            className="flex items-center gap-2 px-3 py-2 cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-300"
                                                        >
                                                            {funnel.isActive ? (
                                                                <>
                                                                    <Pause className="h-4 w-4" /> Hibernate
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Play className="h-4 w-4" /> Activate
                                                                </>
                                                            )}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator className="bg-muted-foreground/5" />
                                                        <DropdownMenuItem 
                                                            onClick={() => handleDelete(funnel.id, funnel.name)}
                                                            className="flex items-center gap-2 px-3 py-2 cursor-pointer font-bold text-sm text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/30"
                                                        >
                                                            <Trash2 className="h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
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
        emerald: 'text-emerald-500 bg-emerald-500/10',
        orange: 'text-orange-500 bg-orange-500/10',
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
                    {value}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">{description}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function FunnelsSkeleton() {
    return (
        <div className="p-4 sm:p-6 space-y-10 max-w-[1400px] mx-auto">
            <div className="flex justify-between items-center gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-10 w-64 rounded" />
                    <Skeleton className="h-4 w-96 rounded" />
                </div>
                <Skeleton className="h-14 w-48 rounded" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-48 rounded" />
                ))}
            </div>
            <div className="space-y-6">
                <div className="flex justify-between">
                    <Skeleton className="h-8 w-48 rounded" />
                    <Skeleton className="h-12 w-64 rounded" />
                </div>
                <Skeleton className="h-[400px] w-full rounded-[2.5rem]" />
            </div>
        </div>
    );
}
