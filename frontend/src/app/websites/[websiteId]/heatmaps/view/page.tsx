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
import { Sparkles, Loader2, Ruler } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Slider } from "@/components/ui/slider";

export default function HeatmapViewPage() {
  const { websiteId } = useParams();
  const { subscription } = useSubscription();
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get('url') || (websiteId === 'demo' ? 'https://seentics.com' : '/');

  // Fetch website data to get the base URL
  const { data: website, isLoading: isLoadingWebsite } = useQuery({
    queryKey: ['website', websiteId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/websites/${websiteId}`);
      return response.data;
    },
    enabled: !!websiteId && websiteId !== 'demo',
  });
  
  const [activeType, setActiveType] = useState<'click' | 'move'>('click');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 2000 }); // Default content size
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 }); // Viewport size
  const [scrollPos, setScrollPos] = useState({ top: 0, left: 0 }); // Current scroll position
  const [showHeightControl, setShowHeightControl] = useState(false);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastScrollSent = useRef(0);

  // Sync scroll from main container to iframe
  const handleMainScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const top = target.scrollTop;
    const left = target.scrollLeft;
    
    setScrollPos({ top, left });
    
    // Throttle messages to iframe to 60fps
    const now = Date.now();
    if (now - lastScrollSent.current > 16) {
        if (iframeRef.current?.contentWindow && !isDemo) {
            iframeRef.current.contentWindow.postMessage({
                type: 'SEENTICS_SET_SCROLL',
                top,
                left
            }, '*');
        }
        lastScrollSent.current = now;
    }
  };

  const isDemo = websiteId === 'demo';
  const isFreePlan = subscription?.plan === 'free';
  const showDummy = isDemo || isFreePlan;

  // Listen for messages from the tracker script in the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SEENTICS_DIMENSIONS') {
        const { height, width } = event.data;
        if (height && height > 0) {
          setDimensions({
            width: width || 1200,
            height: height
          });
          setShowHeightControl(false);
        }
      } else if (event.data?.type === 'SEENTICS_SCROLL') {
        // This is critical for when the user scrolls the iframe directly
        const { scrollTop, scrollLeft } = event.data;
        setScrollPos({ top: scrollTop, left: scrollLeft });
        
        // Also sync the dashboard scroller if it's out of sync
        if (mainScrollRef.current && Math.abs(mainScrollRef.current.scrollTop - scrollTop) > 10) {
            mainScrollRef.current.scrollTop = scrollTop;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Periodically request dimensions from the iframe
  useEffect(() => {
    if (isDemo) {
        setDimensions({ width: 1200, height: 4000 }); // Reasonable demo height
        return;
    }

    let attempts = 0;
    const requestDimensions = () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage('SEENTICS_GET_DIMENSIONS', '*');
        attempts++;
        if (attempts > 5 && dimensions.height <= 2000) {
            setShowHeightControl(true);
        }
      }
    };

    const interval = setInterval(requestDimensions, 3000);
    return () => clearInterval(interval);
  }, [loading, isDemo, dimensions.height]);

  const generateDummyPoints = (type: 'click' | 'move') => {
    const count = type === 'click' ? 100 : 300;
    const dummyPoints = [];
    for (let i = 0; i < count; i++) {
        // Create clusters for more realistic look across the full page height
        const centerX = Math.random() * 900 + 50;
        const centerY = Math.random() * 900 + 50;
        const clusterSize = Math.floor(Math.random() * 12) + 2;
        
        for (let j = 0; j < clusterSize; j++) {
            dummyPoints.push({
                x: Math.round(centerX + (Math.random() - 0.5) * 60),
                y: Math.round(centerY + (Math.random() - 0.5) * 60),
                intensity: Math.floor(Math.random() * 25) + 5
            });
        }
    }
    return dummyPoints;
  };

  const fetchHeatmapData = async () => {
    setLoading(true);
    try {
      if (isDemo || isFreePlan) {
        // Generate more realistic demo points across the whole page (0-1000 grid)
        const mockPoints = [];
        for (let i = 0; i < 300; i++) {
          mockPoints.push({
            x: Math.floor(Math.random() * 800) + 100,
            y: Math.floor(Math.random() * 1000),
            intensity: Math.floor(Math.random() * 50) + 10
          });
        }
        // Add some hot spots
        for (let i = 0; i < 8; i++) {
          const hotX = Math.floor(Math.random() * 800) + 100;
          const hotY = Math.floor(Math.random() * 1000);
          for (let j = 0; j < 40; j++) {
            mockPoints.push({
              x: Math.max(0, Math.min(1000, hotX + (Math.random() * 60 - 30))),
              y: Math.max(0, Math.min(1000, hotY + (Math.random() * 60 - 30))),
              intensity: Math.floor(Math.random() * 80) + 20
            });
          }
        }
        setPoints(mockPoints);
        return;
      }

      const response = await api.get(`/api/v1/heatmaps/data?website_id=${websiteId}&url=${encodeURIComponent(url)}&type=${activeType}`);
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
    const updateSize = () => {
      if (containerRef.current) {
        setViewSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    window.addEventListener('resize', updateSize);
    updateSize();
    const timer = setTimeout(updateSize, 500); 
    return () => {
      window.removeEventListener('resize', updateSize);
      clearTimeout(timer);
    };
  }, [device, loading]);

  const siteUrl = isDemo 
    ? 'https://seentics.com' 
    : (website?.url 
      ? `${website.url.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`
      : url);

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
      <div 
        className="flex-1 bg-muted/30 overflow-y-auto flex flex-col items-center relative scroll-smooth bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]"
        ref={mainScrollRef}
        onScroll={handleMainScroll}
      >
        <div 
            className="w-full flex justify-center pt-8"
            style={{ 
                height: Math.max(dimensions.height || 1000, 1000) + 200, // Extra space at bottom
                minHeight: '100%'
            }}
        >
            <div 
                ref={containerRef}
                className={`sticky top-0 bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-300 ease-in-out ${
                    device === 'desktop' ? 'w-full max-w-7xl' : 
                    device === 'tablet' ? 'w-[768px]' : 
                    'w-[375px]'
                } h-[calc(100vh-80px)] overflow-hidden rounded-t-lg`}
            >
                {/* Heatmap Overlay */}
                {!loading && (isDemo || !isLoadingWebsite) && viewSize.width > 0 && (
                    <div className="absolute inset-0 pointer-events-none z-10">
                        <HeatmapOverlay 
                            points={points} 
                            type={activeType} 
                            width={viewSize.width} 
                            height={viewSize.height}
                            totalWidth={dimensions.width || viewSize.width}
                            totalHeight={dimensions.height || 0}
                            scrollTop={scrollPos.top}
                            scrollLeft={scrollPos.left}
                        />
                    </div>
                )}

                {/* Iframe of the website */}
                {isDemo || !isLoadingWebsite ? (
                    <iframe 
                        ref={iframeRef}
                        src={siteUrl}
                        className="border-none pointer-events-auto"
                        style={{ 
                            height: '100%', 
                            width: 'calc(100% + 20px)', // Offset to hide the native scrollbar
                            marginRight: '-20px'
                        }}
                        title="Heatmap View"
                        scrolling="yes" 
                        onLoad={() => {
                            if (iframeRef.current?.contentWindow) {
                                iframeRef.current.contentWindow.postMessage('SEENTICS_GET_DIMENSIONS', '*');
                            }
                        }}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}

                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-30">
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                            <p className="font-medium text-sm">Syncing heat data...</p>
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
