'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  MousePointerClick, 
  MousePointer2, 
  RefreshCcw,
  Monitor,
  Smartphone,
  Tablet,
  Download,
  Share2,
  Maximize2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import HeatmapOverlay from '@/components/heatmap-overlay';
import api from '@/lib/api';
import { useSubscription } from '@/hooks/useSubscription';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

export default function HeatmapViewPage() {
  const { websiteId } = useParams();
  const { subscription } = useSubscription();
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get('url') || '/';
  
  const [activeType, setActiveType] = useState<'click' | 'move'>('click');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 0, height: 5000 }); // Increased default height
  const [showHeightControl, setShowHeightControl] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch website data to get the real domain
  const { data: website, isLoading: isLoadingWebsite } = useQuery({
    queryKey: ['website', websiteId],
    queryFn: async () => {
      if (websiteId === 'demo') return { url: 'https://seentics.com' };
      const response = await api.get(`/user/websites/${websiteId}`);
      return response.data.data;
    },
    enabled: !!websiteId
  });

  const isDemo = websiteId === 'demo';
  const isFreePlan = subscription?.plan === 'free';
  const showDummy = isDemo || isFreePlan;

  const generateDummyPoints = (type: 'click' | 'move') => {
    const count = type === 'click' ? 50 : 200;
    const dummyPoints = [];
    for (let i = 0; i < count; i++) {
        // Create clusters for more realistic look
        const centerX = Math.random() * 800 + 100;
        const centerY = Math.random() * 800 + 100;
        const clusterSize = Math.floor(Math.random() * 10) + 1;
        
        for (let j = 0; j < clusterSize; j++) {
            dummyPoints.push({
                x: Math.round(centerX + (Math.random() - 0.5) * 50),
                y: Math.round(centerY + (Math.random() - 0.5) * 50),
                intensity: Math.floor(Math.random() * 20) + 1
            });
        }
    }
    return dummyPoints;
  };

  const fetchHeatmapData = async () => {
    if (showDummy) {
        setLoading(true);
        // Simulate network delay
        setTimeout(() => {
            setPoints(generateDummyPoints(activeType));
            setLoading(false);
        }, 800);
        return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/heatmaps/data?website_id=${websiteId}&url=${encodeURIComponent(url)}&type=${activeType}`);
      setPoints(response.data.points || []);
    } catch (err) {
      console.error('Failed to fetch heatmap data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmapData();
  }, [websiteId, url, activeType]);

  useEffect(() => {
    const updateDimensions = () => {
      if (iframeRef.current) {
        // Try to get content height if possible (same-origin only)
        try {
          const contentHeight = iframeRef.current.contentWindow?.document.body.scrollHeight;
          if (contentHeight && contentHeight > 0) {
            setDimensions({
              width: iframeRef.current.offsetWidth,
              height: contentHeight
            });
            return;
          }
        } catch (e) {
          // Ignore CORS error
        }

        // Fallback: Use offsetHeight or a large default if content height is inaccessible
        setDimensions({
          width: iframeRef.current.offsetWidth,
          height: Math.max(1200, iframeRef.current.offsetHeight)
        });
      }
    };

    const timer = setTimeout(updateDimensions, 1500); // Give iframe more time to load
    window.addEventListener('resize', updateDimensions);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [device, loading]);

  const siteUrl = website?.url 
    ? `${website.url.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`
    : url;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {isFreePlan && !isDemo && (
        <div className="px-6 py-2 bg-primary/5 border-b border-primary/20">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-muted-foreground"><strong>Free Plan:</strong> Showing dummy data. Upgrade to see real interactions.</span>
            </span>
            <Link href={`/websites/${websiteId}/billing`}>
              <Button size="sm" variant="link" className="h-auto p-0 text-primary">Upgrade Now</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card z-20 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              Heatmap: {url}
              <Badge variant="outline" className="ml-2 font-normal">
                {activeType === 'click' ? 'Click Map' : 'Move Map'}
              </Badge>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Tabs value={activeType} onValueChange={(val) => setActiveType(val as any)}>
            <TabsList>
              <TabsTrigger value="click" className="gap-2">
                <MousePointerClick className="h-4 w-4" /> Click
              </TabsTrigger>
              <TabsTrigger value="move" className="gap-2">
                <MousePointer2 className="h-4 w-4" /> Move
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center border rounded-md p-1 bg-muted/50">
            <Button 
              variant={device === 'desktop' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => setDevice('desktop')}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button 
              variant={device === 'tablet' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => setDevice('tablet')}
            >
              <Tablet className="h-4 w-4" />
            </Button>
            <Button 
              variant={device === 'mobile' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => setDevice('mobile')}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-8 w-[1px] bg-border mx-2" />

          <Button variant="outline" size="sm" className="gap-2" onClick={fetchHeatmapData}>
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-muted/30 overflow-auto p-0 flex flex-col items-center">
        <div className="w-full h-fit flex justify-center p-8">
            <div 
            ref={containerRef}
            className={`relative bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-300 ease-in-out ${
                device === 'desktop' ? 'w-full max-w-6xl' : 
                device === 'tablet' ? 'w-[768px]' : 
                'w-[375px]'
            }`}
            style={{ height: `${dimensions.height}px` }}
            >
            {/* Heatmap Overlay */}
            {!loading && !isLoadingWebsite && dimensions.width > 0 && dimensions.height > 0 && (
                <HeatmapOverlay 
                points={points} 
                type={activeType} 
                width={dimensions.width} 
                height={dimensions.height} 
                />
            )}

            {/* Iframe of the website */}
            {!isLoadingWebsite ? (
                <iframe 
                ref={iframeRef}
                src={siteUrl}
                className="w-full h-full border-none pointer-events-auto"
                title="Heatmap View"
                scrolling="no"
                onLoad={() => {
                    setTimeout(() => {
                        if (iframeRef.current) {
                            try {
                                const h = iframeRef.current.contentWindow?.document.body.scrollHeight;
                                if (h) setDimensions(d => ({ ...d, height: h }));
                            } catch (error) {
                                console.error('Failed to parse JSON data:', error);
                            }
                        }
                    }, 500);
                }}
                />
            ) : (
                <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}

            {(loading || isLoadingWebsite) && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-30">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="font-medium">Loading heatmap data...</p>
                </div>
                </div>
            )}
            </div>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="px-6 py-2 border-t bg-background text-xs text-muted-foreground flex justify-between items-center">
        <div>
          Showing {points.reduce((acc, p) => acc + p.intensity, 0)} total {activeType === 'click' ? 'clicks' : 'movements'}
        </div>
        <div>
          Resolution: 0.1% grid (1000x1000)
        </div>
      </div>
    </div>
  );
}
