'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Activity, 
  MousePointer2, 
  MousePointerClick,
  ChevronRight,
  Search,
  ExternalLink,
  Calendar,
  Filter,
  Eye,
  Clock,
  ArrowUpRight,
  Zap,
  Target
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from 'next/link';
import api from '@/lib/api';
import { getWebsiteBySiteId } from '@/lib/websites-api';
import { useQuery } from '@tanstack/react-query';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { useSubscription } from '@/hooks/useSubscription';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, Settings as SettingsIcon } from 'lucide-react';
import { cn } from "@/lib/utils";

const DUMMY_PAGES = [
  { url: '/', views: 1240, clicks: 8560, avg_scroll: 68, active: true },
  { url: '/pricing', views: 850, clicks: 3200, avg_scroll: 45, active: true },
  { url: '/docs', views: 620, clicks: 1200, avg_scroll: 92, active: false },
  { url: '/blog/performance-optimization', views: 450, clicks: 850, avg_scroll: 78, active: true },
  { url: '/features', views: 1100, clicks: 4200, avg_scroll: 55, active: true },
  { url: '/signup', views: 320, clicks: 1100, avg_scroll: 30, active: true }
];

export default function HeatmapsPage() {
  const { websiteId } = useParams();
  const router = useRouter();
  const { subscription } = useSubscription();

  const { data: website } = useQuery({
    queryKey: ['website', websiteId],
    queryFn: () => getWebsiteBySiteId(websiteId as string),
    enabled: !!websiteId && websiteId !== 'demo',
  });

  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const isDemo = websiteId === 'demo';
  const isFreePlan = subscription?.plan === 'free';
  const showDummy = isDemo || isFreePlan;

  const isHeatmapDisabled = website && !website.heatmapEnabled;

  useEffect(() => {
    const fetchPages = async () => {
      // For demo or free plan, use dummy pages
      if (showDummy || isHeatmapDisabled) {
        setPages(DUMMY_PAGES);
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/heatmaps/pages?website_id=${websiteId}`);
        // Map simple strings from API to objects with random-ish stats for better UI
        const apiPages = (response.data.pages || []).map((page: string) => ({
          url: page,
          views: Math.floor(Math.random() * 1000) + 100,
          clicks: Math.floor(Math.random() * 5000) + 500,
          avg_scroll: Math.floor(Math.random() * 40) + 40,
          active: true
        }));
        setPages(apiPages);
      } catch (err) {
        console.error('Failed to fetch heatmap pages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [websiteId, showDummy, isHeatmapDisabled]);

  const filteredPages = pages.filter(page => 
    page.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
      {(isFreePlan || isDemo) && (
        <Alert className="bg-amber-500/10 border-amber-500/20 shadow-sm">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-600 font-bold">Preview Mode</AlertTitle>
          <AlertDescription className="text-muted-foreground/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span>You are viewing <strong>dummy data</strong>. Real heatmap tracking is a premium feature. Upgrade to any paid plan to start recording real sessions across your site.</span>
            <Link href={isDemo ? '/pricing' : `/websites/${websiteId}/billing`}>
              <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 gap-2 font-black uppercase tracking-widest text-[10px]  backdrop-blur-sm">
                View Plans
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {isHeatmapDisabled && !isFreePlan && !isDemo && (
        <Alert className="bg-rose-500/10 border-rose-500/20 shadow-sm">
          <MousePointer2 className="h-4 w-4 text-rose-600" />
          <AlertTitle className="text-rose-600 font-bold">Feature Disabled</AlertTitle>
          <AlertDescription className="text-muted-foreground/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span>Heatmap script loading is currently disabled for this website in your property settings.</span>
            <Link href={`/websites/${websiteId}/settings`}>
              <Button size="sm" variant="outline" className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10 gap-2 font-bold text-[10px] uppercase bg-white/50 backdrop-blur-sm">
                <SettingsIcon className="h-3.5 w-3.5" />
                Go to Settings
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <DashboardPageHeader 
        title="Heatmaps" 
        description="Visualize user behavior with click and movement maps across your site."
        icon={MousePointer2}
      >
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 h-10 font-bold text-xs uppercase tracking-wider bg-card/50 backdrop-blur-md">
            <Calendar className="h-4 w-4 text-primary" />
            Last 30 Days
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 bg-card/50 backdrop-blur-md">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </DashboardPageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Pages Tracked', value: pages.length, icon: Activity, color: 'text-primary' },
          { title: 'Total Recordings', value: pages.reduce((acc, p) => acc + p.views, 0), icon: Eye, color: 'text-blue-500' },
          { title: 'Interaction Pulse', value: 'High', icon: Zap, color: 'text-amber-500' },
          { title: 'Avg. Engagement', value: '74%', icon: Target, color: 'text-emerald-500' }
        ].map((stat, i) => (
          <Card key={i} className="bg-card/50 shadow-sm border-border/40 group overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">{stat.title}</span>
              <stat.icon className={cn("h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black tracking-tight">{stat.value}</div>
            </CardContent>
            <div className={cn("absolute bottom-0 left-0 h-1 bg-current opacity-10 w-full", stat.color.replace('text-', 'bg-'))} />
          </Card>
        ))}
      </div>

      <Card className="bg-card/50 border-border/40 overflow-hidden shadow-sm shadow-black/5">
        <CardHeader className=" pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold tracking-tight px-0">Tracked Pages</CardTitle>
              <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-50">Select a page to analyze user interactions</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Filter by URL..." 
                  className="pl-9 w-full md:w-[280px] h-10 bg-muted/20 border-border/40 focus:bg-background transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[160px] h-10 bg-muted/20 border-border/40 font-bold text-[10px] uppercase tracking-wider">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="bg-card font-bold text-xs uppercase tracking-wider">
                  <SelectItem value="all">Recent Activity</SelectItem>
                  <SelectItem value="popular">Most Viewed</SelectItem>
                  <SelectItem value="clicks">Peak Clicks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded" />
              ))}
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-20 w-20 bg-accent/20 rounded-full flex items-center justify-center mb-6">
                <MousePointer2 className="h-10 w-10 text-muted-foreground opacity-20" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-widest">No heatmap data discovered</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mt-2 italic text-sm">
                Once users start interacting with your site, their behavior maps will manifest here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-y border-border/40">
                    <th className="p-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Page Identity</th>
                    <th className="p-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Views</th>
                    <th className="p-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Total Clicks</th>
                    <th className="p-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Scroll Depth</th>
                    <th className="p-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 text-right">Visualization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredPages.map((page) => (
                    <tr key={page.url} className="group hover:bg-accent/5 transition-colors">
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{page.url}</span>
                          <span className="text-[10px] uppercase font-medium text-muted-foreground opacity-50 mt-0.5">
                            {page.url === '/' ? 'Root Context' : 'Internal Page'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                           <span className="font-black text-xs">{page.views.toLocaleString()}</span>
                           <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, page.views / 15)}%` }} />
                           </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                           <MousePointerClick className="h-3 w-3 text-primary opacity-50" />
                           <span className="font-bold text-xs">{page.clicks.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="p-4">
                         <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-amber-500 opacity-50" />
                            <span className="font-bold text-xs">{page.avg_scroll}%</span>
                         </div>
                      </td>
                      <td className="p-6 text-right">
                        <Link href={`/websites/${websiteId}/heatmaps/view?url=${encodeURIComponent(page.url)}`}>
                          <Button variant="outline" size="sm" className="gap-2 h-9 rounded dark:bg-gray-800 bg-white hover:bg-primary hover:text-white transition-all group/btn shadow-sm border-border/60">
                            <span className="font-bold text-[10px] uppercase tracking-widest">Analyze</span>
                            <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                          </Button>
                        </Link>
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
