'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { TrafficOverview } from '@/components/analytics/TrafficOverview';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { TopCountriesChart } from '@/components/analytics/TopCountriesChart';
import { TopDevicesChart } from '@/components/analytics/TopDevicesChart';
import { WebVitalsChart } from '@/components/analytics/WebVitalsChart';
import { Loader2, Zap, Globe, CalendarIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from '@/components/theme-toggle';

export default function PublicDashboardPage() {
    const params = useParams();
    const publicId = params?.publicId as string;
    const [dateRange, setDateRange] = useState(7);

    const { data: dashboardData, isLoading, error } = useQuery({
        queryKey: ['public-analytics', publicId, dateRange],
        queryFn: async () => {
            const { data } = await api.get(`/public/analytics/${publicId}`, {
                params: { days: dateRange }
            });
            return data;
        },
        enabled: !!publicId
    });

    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center flex-col gap-4 bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="font-black text-sm uppercase tracking-widest text-muted-foreground animate-pulse">Loading Public Dashboard...</p>
            </div>
        );
    }

    if (error || !dashboardData) {
        return (
            <div className="flex h-screen w-screen items-center justify-center flex-col p-6 text-center bg-background">
                <div className="h-20 w-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-6">
                    <Globe className="h-10 w-10 text-rose-500" />
                </div>
                <h1 className="text-3xl font-black tracking-tighter mb-2">Dashboard Not Found</h1>
                <p className="text-muted-foreground max-w-sm mb-8">
                    This dashboard may have been made private or the link is invalid.
                </p>
                <a href="/" className="text-primary font-bold hover:underline">Go back to Seentics</a>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-primary flex items-center justify-center rounded-xl shadow-lg shadow-primary/20">
                            <Zap className="h-6 w-6 text-primary-foreground fill-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight leading-none uppercase italic">Seentics</h1>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Public Analytics</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Select value={dateRange.toString()} onValueChange={(v) => setDateRange(parseInt(v))}>
                            <SelectTrigger className="w-[180px] h-10 font-bold bg-muted/20 border-none ring-0 focus:ring-0">
                                <CalendarIcon className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Select range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">Last 24 Hours</SelectItem>
                                <SelectItem value="7">Last 7 Days</SelectItem>
                                <SelectItem value="30">Last 30 Days</SelectItem>
                                <SelectItem value="90">Last 90 Days</SelectItem>
                            </SelectContent>
                        </Select>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-4xl font-black tracking-tighter uppercase italic">{dashboardData.website_id}</h2>
                        <p className="text-muted-foreground font-bold text-sm">Real-time engagement and traffic insights.</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                       <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">
                           {dashboardData.live_visitors} Live Visitors
                        </span>
                    </div>
                </div>

                <SummaryCards data={dashboardData} />

                <TrafficOverview 
                    dailyStats={dashboardData.daily_stats || []} 
                    hourlyStats={dashboardData.hourly_stats || []}
                    isLoading={false} 
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <TopPagesChart data={dashboardData.top_pages || []} isLoading={false} />
                    <TopSourcesChart data={dashboardData.top_sources || []} isLoading={false} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <TopCountriesChart data={dashboardData.top_countries || []} isLoading={false} />
                    <TopDevicesChart data={dashboardData.top_devices || []} isLoading={false} />
                    <div className="flex items-center justify-center p-8 bg-accent/5 rounded-3xl border border-dashed border-border/60">
                         <div className="text-center">
                            <Zap className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground whitespace-pre-wrap leading-relaxed">
                               Analytics Powered by\nSeentics Platform
                            </p>
                         </div>
                    </div>
                </div>
            </main>

            <footer className="border-t py-12 mt-20">
                <div className="text-center space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Generated by Seentics Open Source Analytics
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 italic">
                        Real-time, privacy-friendly website performance tracking.
                    </p>
                </div>
            </footer>
        </div>
    );
}
