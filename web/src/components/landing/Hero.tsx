'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users, Globe, Download, Settings, Sun, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';
import { useMemo } from 'react';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { TrafficOverview } from '@/components/analytics/TrafficOverview';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { Card, CardContent } from '@/components/ui/card';
import { ChartErrorBoundary } from '@/components/analytics/ChartErrorBoundary';
import { demoAnalyticsData } from '@/lib/demo';
import { Logo } from '@/components/ui/logo';

/* ─── Real dashboard preview using actual components with demo data ─── */
function DashboardPreview() {
  const demoData = useMemo(() => demoAnalyticsData(), []);

  const transformedTopPages = useMemo(() => ({
    top_pages: demoData.topPages?.top_pages?.map((page: any) => ({
      page: page.page || '/',
      views: page.views || 0,
      unique_visitors: page.unique || 0,
      avg_time_on_page: page.avg_time || 0,
      bounce_rate: page.bounce_rate || 0,
    })) ?? [],
  }), [demoData]);

  const transformedTopReferrers = useMemo(() => ({
    top_referrers: demoData.topReferrers?.top_referrers?.map((ref: any) => ({
      referrer: ref.referrer || 'Direct',
      visitors: ref.unique || 0,
      page_views: ref.views || 0,
      avg_session_duration: 0,
    })) ?? [],
  }), [demoData]);

  return (
    <div
      className="overflow-hidden relative text-left"
      style={{ maxHeight: '820px' }}
    >
      {/* Scaled-down real dashboard */}
      <div
        className="pointer-events-none select-none"
        style={{
          transform: 'scale(0.55)',
          transformOrigin: 'top center',
          width: `${100 / 0.55}%`,
          marginLeft: `${-(100 / 0.55 - 100) / 2}%`,
        }}
      >
        {/* ── Dashboard Header ── */}
        <div className="flex items-center gap-2 px-4 md:px-8 py-2 flex-wrap">
          <Logo size="sm" showText className="hidden sm:flex" />
          <Logo size="sm" className="sm:hidden" />
          <div className="w-px h-5 bg-border/60 mx-1" />
          <div className="flex items-center gap-1.5 h-8 px-3 bg-card/50 rounded-md border border-border/40 text-xs">
            <Globe className="h-3 w-3 text-primary shrink-0" />
            <span className="font-medium text-foreground">Demo Site</span>
          </div>
          <div className="flex-1" />
          <div className="h-8 px-2.5 flex items-center gap-1.5 bg-card/50 rounded-md border border-border/40 text-[11px] font-medium text-muted-foreground">
            Last 7 days
          </div>
          <div className="h-8 px-2.5 flex items-center gap-1.5 bg-card/50 rounded-md border border-border/40 text-[11px] font-medium text-muted-foreground">
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Export</span>
          </div>
          <div className="h-8 w-8 flex items-center justify-center bg-card/50 rounded-md border border-border/40">
            <Settings className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="h-8 w-8 flex items-center justify-center bg-card/50 rounded-md border border-border/40">
            <Sun className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* ── Dashboard Content ── */}
        <div className="px-4 md:px-8 pb-8 space-y-6">
          {/* Real SummaryCards */}
          <SummaryCards
            websiteId=""
            isDemo={true}
            isLoading={false}
            data={demoData.dashboardData}
            dailyStats={demoData.dailyStats}
            visitorInsights={demoData.visitorInsights}
          />

          {/* Real TrafficOverview */}
          <ChartErrorBoundary label="Traffic Overview">
            <TrafficOverview
              dailyStats={demoData.dailyStats}
              hourlyStats={demoData.hourlyStats}
              isLoading={false}
              showComparison={false}
            />
          </ChartErrorBoundary>

          {/* Audience Intelligence section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-tight">Audience Intelligence</h2>
              <div className="h-px bg-border flex-1 ml-3" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="border border-border/60 bg-card shadow-sm">
                <CardContent className="p-5">
                  <ChartErrorBoundary label="Top Pages">
                    <TopPagesChart
                      data={transformedTopPages}
                      entryPages={demoData.visitorInsights?.visitor_insights?.top_entry_pages}
                      exitPages={demoData.visitorInsights?.visitor_insights?.top_exit_pages}
                      isLoading={false}
                    />
                  </ChartErrorBoundary>
                </CardContent>
              </Card>

              <Card className="border border-border/60 bg-card shadow-sm">
                <CardContent className="p-5">
                  <ChartErrorBoundary label="Top Sources">
                    <TopSourcesChart data={transformedTopReferrers} isLoading={false} />
                  </ChartErrorBoundary>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade — blends preview into page background */}
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
    </div>
  );
}

export default function Hero() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 bg-background overflow-hidden">
      {/* Dot pattern background */}
      <div className="absolute inset-0 [background-image:radial-gradient(hsl(var(--border)/0.4)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,hsl(var(--background))_70%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/[0.07] rounded-full blur-[120px]" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center gap-2 mb-8"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/50 border border-border/60 text-xs font-medium text-muted-foreground">
              Open Source &middot; APIs &amp; SDKs &middot; Self-Hosted
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs font-semibold text-indigo-400">
              <Sparkles className="h-3 w-3" />
              AI-Powered
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mb-6"
          >
            <span className="block text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.2]">
              AI-Powered Analytics for
            </span>
            <span className="block text-4xl md:text-6xl font-bold tracking-tight leading-[1.2] mt-1">
              <span className="text-primary underline decoration-primary/30 decoration-4 underline-offset-4">Developers & Product Teams</span>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed"
          >
            Page analytics, session recordings, heatmaps, funnels, and automations — all in one platform. Ask anything about your data in plain English. Self-hosted, open source, complete data ownership.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex items-center justify-center gap-3 mb-16"
          >
            {isAuthenticated ? (
              <Link href="/websites">
                <Button size="lg" className="h-11 px-7 text-sm font-semibold rounded-lg gap-2 shadow-sm">
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link href="/signup">
                <Button size="lg" className="h-11 px-7 text-sm font-semibold rounded-lg gap-2 shadow-sm">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link href="/websites/demo">
              <Button variant="outline" size="lg" className="h-11 px-6 text-sm font-medium rounded-lg gap-2 border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/50">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live Demo
              </Button>
            </Link>
          </motion.div>

          {/* 3D Perspective Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            className="relative max-w-5xl mx-auto [perspective:1200px]"
          >
            <div className="absolute -inset-8 bg-primary/[0.04] rounded-3xl blur-3xl" />
            <div className="relative [transform:perspective(1200px)_rotateX(2deg)] origin-bottom">
              <DashboardPreview />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
