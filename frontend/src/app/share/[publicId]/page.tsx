'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { usePublicDashboardData } from '@/lib/analytics-api';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { TrafficOverview } from '@/components/analytics/TrafficOverview';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { TopCountriesChart } from '@/components/analytics/TopCountriesChart';
import { TopDevicesChart } from '@/components/analytics/TopDevicesChart';
import { WebVitalsChart } from '@/components/analytics/WebVitalsChart';
import { GeolocationOverview } from '@/components/analytics/GeolocationOverview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, BarChart3, Clock, Zap, AlertCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function PublicDashboardPage() {
    const params = useParams();
    const publicId = params?.publicId as string;
    const [dateRange, setDateRange] = useState(7);

    const { data, isLoading, error } = usePublicDashboardData(publicId, dateRange);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-rose-500" />
                <h1 className="text-2xl font-black uppercase tracking-tight">Dashboard Not Available</h1>
                <p className="text-muted-foreground max-w-md font-medium">
                    This dashboard might be private, the link might be expired, or the website has been removed.
                </p>
                <a href="/" className="text-primary font-bold hover:underline">Go to Seentics Home</a>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
                            <BarChart3 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-black uppercase tracking-tighter">
                                {isLoading ? <Skeleton className="h-4 w-32" /> : data?.website_id || 'Analytics Dashboard'}
                            </h1>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                <Globe className="h-3 w-3" /> Public Dashboard
                            </p>
                        </div>
                    </div>
                    <ThemeToggle />
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
                {/* Summary Stats */}
                <SummaryCards
                    data={data || {
                        total_visitors: 0,
                        unique_visitors: 0,
                        live_visitors: 0,
                        page_views: 0,
                        session_duration: 0,
                        bounce_rate: 0,
                        comparison: {}
                    }}
                    isLoading={isLoading}
                />

                {/* Traffic Chart */}
                <section>
                    <TrafficOverview
                        dailyStats={data?.daily_stats || []}
                        hourlyStats={data?.hourly_stats || []}
                        isLoading={isLoading}
                    />
                </section>

                {/* Web Vitals */}
                <section>
                    <WebVitalsChart
                        data={data?.web_vitals || []}
                        isLoading={isLoading}
                    />
                </section>

                {/* Breakdowns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <TopPagesChart 
                        data={data?.top_pages || []} 
                        isLoading={isLoading} 
                    />
                    <TopSourcesChart 
                        data={data?.top_sources || []} 
                        isLoading={isLoading} 
                    />
                    <TopCountriesChart 
                        data={data?.top_countries || []} 
                        isLoading={isLoading} 
                    />
                    <TopDevicesChart 
                        data={data?.top_devices || []} 
                        isLoading={isLoading} 
                    />
                </div>

                {/* Geolocation */}
                <section>
                    <GeolocationOverview 
                        data={data?.geolocation || { countries: [], continents: [], regions: [], cities: [] }}
                        isLoading={isLoading}
                    />
                </section>
            </main>

            <footer className="border-t border-border/40 py-8 bg-white dark:bg-slate-900">
                <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Powered by <span className="text-primary">Seentics Analytics</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        Simple, Privacy-focused Google Analytics Alternative.
                    </p>
                </div>
            </footer>
        </div>
    );
}
