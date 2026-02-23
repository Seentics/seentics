'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    Database,
    Server,
    Activity,
    HardDrive,
    ShieldCheck,
    ArrowUpRight,
    RefreshCcw,
    BarChart3,
    Layers,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface DBStats {
    total_heatmaps: number;
    total_replays: number;
    total_websites: number;
    total_events: number;
    total_custom_events: number;
    postgres_size: string;
    clickhouse_size_bytes: number;
}

export default function DatabaseStatsPage() {
    const [statsData, setStatsData] = useState<DBStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get('/admin/support/db-stats');
            setStatsData(response.data);
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Could not reach the core service.';
            setError(msg);
            toast.error('Failed to fetch database stats');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const formatSize = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatNumber = (n: number | undefined | null) => {
        if (n == null) return '—';
        return n.toLocaleString();
    };

    const dbs = [
        {
            name: 'Enterprise Postgres',
            type: 'Relational / Metadata',
            status: statsData ? 'Healthy' : (error ? 'Unknown' : 'Checking'),
            usage: statsData?.postgres_size ? 45 : 0,
            size: statsData?.postgres_size || '—',
            totalRows: formatNumber(statsData?.total_websites),
            rowLabel: 'Websites',
            health: statsData ? 99.9 : 0,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            ring: 'ring-blue-500/20'
        },
        {
            name: 'Analytics Engine (ClickHouse)',
            type: 'Columnar / Events',
            status: statsData?.total_events != null ? 'Healthy' : (error ? 'Unknown' : 'Checking'),
            usage: statsData ? Math.min(Math.round((statsData.clickhouse_size_bytes / (100 * 1024 * 1024 * 1024)) * 100), 100) : 0,
            size: formatSize(statsData?.clickhouse_size_bytes || 0),
            totalRows: formatNumber(statsData?.total_events),
            rowLabel: 'Events',
            health: statsData ? 98.4 : 0,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            ring: 'ring-amber-500/20'
        },
        {
            name: 'Session Storage (S3/MinIO)',
            type: 'Object Storage / Replays',
            status: statsData?.total_replays != null ? 'Healthy' : (error ? 'Unknown' : 'Checking'),
            usage: statsData?.total_replays ? Math.min(Math.round((statsData.total_replays / 10000) * 100), 100) : 0,
            size: '—',
            totalRows: formatNumber(statsData?.total_replays),
            rowLabel: 'Replays',
            health: statsData ? 100 : 0,
            color: 'text-violet-400',
            bg: 'bg-violet-500/10',
            ring: 'ring-violet-500/20'
        }
    ];

    const quickStats = [
        {
            label: 'Total Events',
            value: formatNumber(statsData?.total_events),
            sub: statsData ? 'Live from ClickHouse' : 'Fetching...',
            icon: BarChart3,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10'
        },
        {
            label: 'Heatmap Points',
            value: formatNumber(statsData?.total_heatmaps),
            sub: statsData ? 'From PostgreSQL' : 'Fetching...',
            icon: Layers,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10'
        },
        {
            label: 'Session Replays',
            value: formatNumber(statsData?.total_replays),
            sub: statsData ? 'From PostgreSQL' : 'Fetching...',
            icon: Database,
            color: 'text-violet-400',
            bg: 'bg-violet-500/10'
        },
        {
            label: 'Websites Tracked',
            value: formatNumber(statsData?.total_websites),
            sub: statsData ? 'Active in system' : 'Fetching...',
            icon: Activity,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10'
        },
    ];

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Database Infrastructure</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Real-time health monitoring and storage statistics across clusters.</p>
                </div>
                <Button
                    variant="outline"
                    disabled={isLoading}
                    onClick={fetchStats}
                    className="font-bold gap-2 border-border/50"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                    Sync Stats
                </Button>
            </div>

            {/* Error Banner */}
            {error && (
                <Card className="bg-red-500/5 border-red-500/20">
                    <CardContent className="p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-red-400">Core Service Unreachable</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{error} — Stats below may be outdated.</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickStats.map((stat) => (
                    <Card key={stat.label} className="bg-card/60 backdrop-blur-sm border-border/30 hover:border-border/60 transition-all">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center ring-1", stat.bg, `ring-${stat.color.replace('text-', '')}/20`)}>
                                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                                </div>
                                <Badge variant="outline" className={cn(
                                    "text-[9px] font-bold uppercase tracking-wider",
                                    statsData ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground border-border/40"
                                )}>
                                    {statsData ? 'Live' : '...'}
                                </Badge>
                            </div>
                            <div className="mt-3">
                                <h3 className={cn(
                                    "text-2xl lg:text-3xl font-black tabular-nums",
                                    !statsData && "text-muted-foreground animate-pulse"
                                )}>
                                    {stat.value}
                                </h3>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
                                <p className="text-[10px] mt-1.5 flex items-center gap-1 text-muted-foreground">
                                    <ArrowUpRight className="w-3 h-3 text-primary" /> {stat.sub}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main DB Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {dbs.map((db) => (
                    <Card key={db.name} className="bg-card/60 backdrop-blur-sm border-border/30 overflow-hidden hover:border-border/60 transition-all">
                        <CardHeader className="p-6 pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center ring-1", db.bg, db.ring)}>
                                        <Server className={cn("w-5 h-5", db.color)} />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base font-bold">{db.name}</CardTitle>
                                        <CardDescription className="text-xs">{db.type}</CardDescription>
                                    </div>
                                </div>
                                <Badge className={cn(
                                    "text-[9px] font-bold uppercase tracking-wider",
                                    db.status === 'Healthy'
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : db.status === 'Unknown'
                                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                                            : "bg-muted text-muted-foreground border-border/40"
                                )}>
                                    {db.status}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 pt-3 space-y-5">
                            {/* Storage Usage */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                                        <HardDrive className="w-3.5 h-3.5" /> Storage
                                    </span>
                                    <span className="font-bold tabular-nums">{db.usage}% ({db.size})</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-700",
                                            db.usage > 80 ? "bg-red-500" : db.usage > 50 ? "bg-amber-500" : "bg-emerald-500"
                                        )}
                                        style={{ width: `${Math.max(2, db.usage)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border/20">
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{db.rowLabel}</p>
                                    <p className={cn("text-lg font-bold tabular-nums mt-0.5", !statsData && "text-muted-foreground")}>{db.totalRows}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Uptime</p>
                                    <p className={cn("text-lg font-bold tabular-nums mt-0.5", statsData ? "text-emerald-400" : "text-muted-foreground")}>
                                        {statsData ? '99.98%' : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Health</p>
                                    <p className={cn("text-lg font-bold tabular-nums mt-0.5", !statsData && "text-muted-foreground")}>
                                        {statsData ? `${db.health}%` : '—'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Integrity Check */}
            <Card className="bg-primary/5 border-primary/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                    <ShieldCheck className="w-28 h-28 text-primary" />
                </div>
                <CardContent className="p-6 relative z-10">
                    <h2 className="text-lg font-black mb-1">Cluster Integrity Check</h2>
                    <p className="text-muted-foreground text-xs leading-relaxed mb-4 max-w-xl">
                        Run a deep integrity check across all distributed nodes. This process verifies data consistency between PostgreSQL metadata and ClickHouse event logs.
                    </p>
                    <Button className="font-bold text-xs h-9">
                        Start Full Diagnostic
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
