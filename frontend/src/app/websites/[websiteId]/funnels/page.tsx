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
    Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFunnels, useDeleteFunnel } from '@/lib/funnels-api';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function FunnelsPage() {
    const params = useParams();
    const router = useRouter();
    const websiteId = params?.websiteId as string;
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');

    const { data, isLoading, error } = useFunnels(websiteId);
    const deleteFunnel = useDeleteFunnel();

    const funnels = data?.funnels || [];

    const filteredFunnels = funnels.filter(funnel =>
        funnel.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = async (funnelId: string, name: string) => {
        if (!confirm(`Are you sure you want to delete funnel "${name}"?`)) return;

        try {
            await deleteFunnel.mutateAsync({ websiteId, funnelId });
            toast({
                title: "Funnel Deleted",
                description: `"${name}" has been deleted.`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete funnel.",
                variant: "destructive",
            });
        }
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
            <div className="p-4 sm:p-6 text-center">
                <p className="text-red-500">Failed to load funnels.</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1280px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Conversion Funnels</h1>
                    <p className="text-muted-foreground font-medium">Track and optimize multi-step user journeys.</p>
                </div>
                <Link href={`/websites/${websiteId}/funnels/builder`}>
                    <Button variant="brand" className="h-12 px-6 font-black rounded-2xl gap-2 shadow-xl shadow-primary/20">
                        <Plus className="h-5 w-5" />
                        Create Funnel
                    </Button>
                </Link>
            </div>

            {/* Funnel Insights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {funnels.slice(0, 4).map((funnel) => (
                    <Card key={funnel.id} className="border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-card dark:bg-gray-800 rounded-md hover:shadow-xl transition-all group">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                    <Filter size={24} />
                                </div>
                                <Badge variant="secondary" className="bg-primary/5 text-primary border-0 font-black text-[10px] py-1 px-3">
                                    {funnel.stats?.conversionRate || 0}% CVR
                                </Badge>
                            </div>
                            <CardTitle className="text-lg font-black text-slate-900 dark:text-white truncate">{funnel.name}</CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-widest">{(funnel.steps || []).length} STEPS JOURNEY</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center text-[11px] font-bold text-muted-foreground">
                                    <span>Entries:</span>
                                    <span>{funnel.stats?.totalEntries?.toLocaleString() || 0}</span>
                                </div>
                                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: `${funnel.stats?.conversionRate || 0}%` }} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-muted-foreground/5">
                                <div className="flex items-center gap-2">
                                    <Users size={14} className="text-muted-foreground" />
                                    <span className="text-xs font-black">{funnel.stats?.completions?.toLocaleString() || 0}</span>
                                </div>
                                <Link href={`/websites/${websiteId}/funnels/builder?id=${funnel.id}`}>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors">
                                        <ArrowRight size={16} />
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Detailed Funnel Management */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Active Funnel Audit</h2>
                    <div className="relative group w-full max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
                        <Input
                            placeholder="Find funnel..."
                            className="pl-10 h-10 bg-muted/20 border-none shadow-none rounded-xl text-xs font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-card dark:bg-gray-800 rounded-md overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/30 border-b border-muted-foreground/10">
                                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Funnel Name</th>
                                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Entries</th>
                                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Conversion</th>
                                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-muted-foreground/5">
                            {filteredFunnels.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-12 text-center text-muted-foreground font-medium">
                                        No funnels found.
                                    </td>
                                </tr>
                            ) : (
                                filteredFunnels.map((funnel) => (
                                    <tr key={funnel.id} className="hover:bg-muted/5 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-slate-600 dark:text-slate-400">
                                                    <BarChart3 size={16} />
                                                </div>
                                                <span className="text-sm font-black text-slate-900 dark:text-white">{funnel.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center text-sm font-bold text-muted-foreground">
                                            {funnel.stats?.totalEntries?.toLocaleString() || 0}
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <Badge variant="outline" className="rounded-lg font-black border-emerald-500/20 text-emerald-500 bg-emerald-500/5">
                                                {funnel.stats?.conversionRate || 0}%
                                            </Badge>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-9 w-9 p-0 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500"
                                                    onClick={() => handleDelete(funnel.id, funnel.name)}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                                <Link href={`/websites/${websiteId}/funnels/builder?id=${funnel.id}`}>
                                                    <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-border font-bold text-[10px] uppercase tracking-wider gap-2">
                                                        <TrendingUp size={14} />
                                                        Breakdown
                                                    </Button>
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Advanced Module Teaser */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                <div className="bg-slate-900 dark:bg-slate-950 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full -mr-20 -mt-20 group-hover:bg-primary/20 transition-all duration-1000" />
                    <h4 className="text-white text-xl font-black mb-4 relative z-10">Heatmaps Synergy</h4>
                    <p className="text-slate-400 text-sm font-medium mb-6 relative z-10 leading-relaxed">
                        Deeply analyze drop-offs by overlaying heatmaps on funnel steps. See exactly where they clicked before leaving.
                    </p>
                    <Button size="sm" variant="brand" className="rounded-xl font-black text-[11px] uppercase tracking-widest relative z-10">
                        Enable Heatmaps
                    </Button>
                </div>
                <div className="bg-blue-600 p-8 rounded-[2.5rem] border border-blue-500/20 relative overflow-hidden group">
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full -ml-20 -mb-20 group-hover:bg-white/20 transition-all duration-1000" />
                    <h4 className="text-white text-xl font-black mb-4 relative z-10">AI Optimization</h4>
                    <p className="text-blue-100 text-sm font-medium mb-6 relative z-10 leading-relaxed">
                        Let Seentics AI suggest funnel optimizations based on user behavior patterns and A/B test results.
                    </p>
                    <Button size="sm" variant="secondary" className="rounded-xl font-black text-[11px] uppercase tracking-widest relative z-10 bg-white text-blue-600 border-0 hover:bg-white/90 shadow-2xl">
                        Try AI Beta
                    </Button>
                </div>
            </div>
        </div>
    );
}
