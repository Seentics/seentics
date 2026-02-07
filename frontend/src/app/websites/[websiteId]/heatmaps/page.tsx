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
  Filter
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
import Link from 'next/link';
import api from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { useSubscription } from '@/hooks/useSubscription';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles } from 'lucide-react';

const DUMMY_PAGES = [
  '/',
  '/pricing',
  '/docs',
  '/blog/performance-optimization',
  '/features',
  '/signup'
];

export default function HeatmapsPage() {
  const { websiteId } = useParams();
  const router = useRouter();
  const { subscription } = useSubscription();
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const isDemo = websiteId === 'demo';
  const isFreePlan = subscription?.plan === 'free';
  const showDummy = isDemo || isFreePlan;

  useEffect(() => {
    const fetchPages = async () => {
      // For demo or free plan, use dummy pages
      if (showDummy) {
        setPages(DUMMY_PAGES);
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/api/v1/heatmaps/pages?website_id=${websiteId}`);
        setPages(response.data.pages || []);
      } catch (err) {
        console.error('Failed to fetch heatmap pages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [websiteId, showDummy]);

  const filteredPages = pages.filter(page => 
    page.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {isFreePlan && !isDemo && (
        <Alert className="bg-primary/5 border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary font-bold">Premium Feature</AlertTitle>
          <AlertDescription className="text-muted-foreground flex items-center justify-between">
            <span>Heatmaps are only available on paid plans. You are currently seeing <strong>dummy data</strong> for demonstration purposes. Upgrade to see real interactions on your site.</span>
            <Link href={`/websites/${websiteId}/billing`}>
              <Button size="sm" className="ml-4">Upgrade Now</Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <DashboardPageHeader 
        title="Heatmaps" 
        description="Visualize user behavior with click and movement maps across your site."
        icon={MousePointer2}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Last 30 Days
          </Button>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </DashboardPageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pages Tracked</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pages.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Click Maps</CardTitle>
            <MousePointerClick className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Enabled</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Move Maps</CardTitle>
            <MousePointer2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Enabled</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tracked Pages</CardTitle>
          <CardDescription>Select a page to view its heatmap visualization.</CardDescription>
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search pages..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pages</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="recent">Recently Tracked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-medium">No heatmap data yet</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Once users start visiting your site, heatmap data will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="border rounded-md divide-y">
              {filteredPages.map((page) => (
                <div key={page} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col">
                    <span className="font-medium">{page}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-md">
                      {page === '/' ? 'Home Page' : page}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/websites/${websiteId}/heatmaps/view?url=${encodeURIComponent(page)}`}>
                      <Button variant="ghost" size="sm" className="gap-2">
                        View Heatmap <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
