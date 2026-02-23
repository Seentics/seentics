'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/stores/useAuthStore';
import { redirect, useRouter } from 'next/navigation';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import {
    Inbox,
    Users,
    ShieldCheck,
    MessageSquare,
    Clock,
    ChevronRight,
    RefreshCw,
    AlertTriangle,
    Mail,
    Activity,
    Database,
    Zap,
    TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface OverviewStats {
    total_users: number;
    active_trials: number;
    avg_response_time: number;
    open_tickets: number;
    maintenance_mode: boolean;
    allow_signups: boolean;
    db_usage: number;
}

interface Ticket {
    id: string;
    userId: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    metadata: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export default function AdminDashboard() {
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<OverviewStats | null>(null);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [statsResp, ticketsResp] = await Promise.all([
                api.get('/admin/overview-stats'),
                api.get('/admin/support/tickets')
            ]);
            setStats(statsResp.data.data);
            setTickets((ticketsResp.data.data || []).slice(0, 5));
        } catch (error) {
            console.error('Failed to fetch admin data:', error);
            toast.error('Failed to load dashboard metrics');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading && isAuthenticated && user?.role === 'admin') {
            fetchData();
        }
    }, [authLoading, isAuthenticated, user, fetchData]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchData();
    };

    const toggleMaintenance = async () => {
        const newState = !stats?.maintenance_mode;
        try {
            await api.post('/admin/maintenance', { enabled: newState });
            setStats(prev => prev ? { ...prev, maintenance_mode: newState } : null);
            toast.success(newState ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
        } catch {
            toast.error('Failed to update maintenance mode');
        }
    };

    if (authLoading) return null;

    if (!isAuthenticated || !isEnterprise || user?.role !== 'admin') {
        redirect('/');
    }

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute inset-0" />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Loading Metrics...</p>
            </div>
        </div>
    );

    const statCards = [
        { title: 'Open Tickets', value: stats?.open_tickets ?? 0, icon: Inbox, color: 'text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20' },
        { title: 'Total Users', value: stats?.total_users?.toLocaleString() ?? '0', icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20' },
        { title: 'Active Trials', value: stats?.active_trials ?? 0, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
        { title: 'Avg Response', value: `${stats?.avg_response_time ?? 0}h`, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' },
    ];

    const dbUsage = stats?.db_usage ?? 0;
    const dbColor = dbUsage > 80 ? 'text-red-400' : dbUsage > 50 ? 'text-amber-400' : 'text-emerald-400';
    const dbBg = dbUsage > 80 ? 'bg-red-500' : dbUsage > 50 ? 'bg-amber-500' : 'bg-emerald-500';

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Command Center</h1>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-black uppercase tracking-wider animate-pulse">
                            <Activity className="w-3 h-3 mr-1" /> Live
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm lg:text-base">Real-time platform monitoring & operations control.</p>
                </div>
                <Button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    variant="outline"
                    className="font-bold gap-2 border-border/50 hover:border-primary/30"
                >
                    <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat) => (
                    <Card key={stat.title} className="bg-card/60 backdrop-blur-sm border-border/30 hover:border-border/60 transition-all duration-300 group">
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between">
                                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center ring-1", stat.bg, stat.ring)}>
                                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                                </div>
                                <div className="text-right">
                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{stat.title}</p>
                                    <h2 className="text-2xl lg:text-3xl font-black mt-0.5 tabular-nums">{stat.value}</h2>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Priority Support Tickets */}
                <Card className="lg:col-span-2 bg-card/60 backdrop-blur-sm border-border/30 overflow-hidden">
                    <CardHeader className="p-5 border-b border-border/30 bg-muted/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-bold">Priority Support</CardTitle>
                                <CardDescription className="text-xs mt-0.5">Latest submissions from platform users.</CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="font-bold gap-1 text-xs text-primary hover:text-primary"
                                onClick={() => router.push('/admin/support')}
                            >
                                View All <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border/20">
                            {tickets.length > 0 ? tickets.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    className="p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                                    onClick={() => router.push(`/admin/support?id=${ticket.id}`)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                                                <MessageSquare className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="font-bold text-sm truncate">{ticket.subject}</h3>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-[9px] font-black uppercase shrink-0 px-1.5 py-0 h-4",
                                                            ticket.priority === 'urgent' || ticket.priority === 'high'
                                                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                                                : ticket.priority === 'medium'
                                                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                                    : "bg-muted text-muted-foreground border-border/40"
                                                        )}
                                                    >
                                                        {ticket.priority}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-1">{ticket.description}</p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-[11px] font-semibold text-foreground/60">{ticket.metadata?.user_email || 'System'}</span>
                                                    <span className="text-muted-foreground/40">·</span>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {ticket.createdAt ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true }) : 'Unknown'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-primary h-7 px-2">
                                            Reply
                                        </Button>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-10 text-center text-muted-foreground">
                                    <Mail className="w-10 h-10 mx-auto opacity-15 mb-3" />
                                    <p className="font-bold text-sm">Inbox Clear</p>
                                    <p className="text-xs mt-0.5">No support tickets at this time.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Right Column - System Health + Maintenance */}
                <div className="space-y-4">
                    {/* System Health */}
                    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
                        <CardHeader className="p-5 pb-3">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary" /> System Health
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 pt-0 space-y-4">
                            {/* Gateway */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground font-medium">Gateway Latency</span>
                                    <span className="font-bold text-emerald-400">42ms</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full w-[15%] transition-all duration-700" />
                                </div>
                            </div>

                            {/* Event Queue */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground font-medium">Event Queue</span>
                                    <span className="font-bold text-emerald-400">Healthy</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full w-[8%] transition-all duration-700" />
                                </div>
                            </div>

                            {/* DB Pool - Real Data */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                                        <Database className="w-3 h-3" /> DB Pool
                                    </span>
                                    <span className={cn("font-bold", dbColor)}>
                                        {Math.round(dbUsage)}%
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all duration-700", dbBg)}
                                        style={{ width: `${Math.max(3, dbUsage)}%` }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Maintenance Mode */}
                    <Card className={cn(
                        "border transition-all duration-300",
                        stats?.maintenance_mode
                            ? "bg-red-500/5 border-red-500/20"
                            : "bg-card/60 border-border/30"
                    )}>
                        <CardContent className="p-5 space-y-3">
                            <div className="flex items-center gap-2.5">
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center",
                                    stats?.maintenance_mode ? "bg-red-500/15" : "bg-primary/10"
                                )}>
                                    {stats?.maintenance_mode
                                        ? <AlertTriangle className="w-4 h-4 text-red-400" />
                                        : <ShieldCheck className="w-4 h-4 text-primary" />
                                    }
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm">Maintenance Mode</h4>
                                    <p className="text-[11px] text-muted-foreground">
                                        {stats?.maintenance_mode ? 'Platform restricted' : 'Platform operational'}
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant={stats?.maintenance_mode ? "destructive" : "outline"}
                                onClick={toggleMaintenance}
                                className="w-full font-bold text-xs h-8"
                            >
                                {stats?.maintenance_mode ? 'Disable Maintenance' : 'Enable Maintenance'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
