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
  Maximize2,
  ChevronLeft,
  Settings2,
  Eye,
  Activity,
  Zap,
  CheckCircle2,
  Layers,
  Info
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
      const response = await api.get(`/websites/${websiteId}`);
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
  const [opacity, setOpacity] = useState([70]);
  const [isSameOrigin, setIsSameOrigin] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastScrollSent = useRef(0);

  // Detect if the URL is same-origin (dashboard page)
  useEffect(() => {
    if (!website?.url) return;
    
    try {
      const currentOrigin = window.location.origin;
      const targetUrl = new URL(website.url);
      const isSame = currentOrigin === targetUrl.origin;
      setIsSameOrigin(isSame);
      console.log('Same-origin check:', { currentOrigin, targetOrigin: targetUrl.origin, isSame });
    } catch (err) {
      console.error('Error checking origin:', err);
      setIsSameOrigin(false);
    }
  }, [website?.url]);

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
        const centerY = Math.random() * 2000 + 100; // Spread across height
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

  useEffect(() => {
    const fetchPoints = async () => {
      setLoading(true);
      if (showDummy) {
        setPoints(generateDummyPoints(activeType));
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/heatmaps?website_id=${websiteId}&url=${encodeURIComponent(url)}&type=${activeType}`);
        setPoints(response.data.points || []);
      } catch (err) {
        console.error('Failed to fetch heatmap points:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPoints();
  }, [websiteId, url, activeType, showDummy]);

  // Update view size on mount and resize
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

  const getDeviceWidth = () => {
      if (device === 'mobile') return 375;
      if (device === 'tablet') return 768;
      return 1200; // Desktop
  };

  const getDeviceScale = () => {
      if (viewSize.width === 0) return 1;
      const targetWidth = getDeviceWidth();
      if (viewSize.width > targetWidth + 40) return 1;
      return (viewSize.width - 40) / targetWidth;
  };

  const deviceWidth = getDeviceWidth();
  const scale = getDeviceScale();

  // Build the URL for the iframe
  // For same-origin authenticated pages, use the direct URL (will share auth cookies)
  // For cross-origin, use the external URL
  const buildIframeUrl = () => {
    if (isDemo) return 'https://seentics.com';
    
    if (!website?.url) return '/';
    
    const baseUrl = website.url.replace(/\/$/, '');
    const fullPath = url.startsWith('/') ? url : `/${url}`;
    const targetUrl = `${baseUrl}${fullPath}`;
    
    // Check if it's same origin
    try {
      const targetOrigin = new URL(targetUrl).origin;
      const currentOrigin = window.location.origin;
      
      if (targetOrigin === currentOrigin) {
        // Same origin - use direct path to share cookies
        return fullPath;
      }
    } catch (err) {
      console.error('Error parsing URL:', err);
    }
    
    return targetUrl;
  };

  const siteUrl = buildIframeUrl();

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden select-none">
      {/* Premium Navigation Header */}
      <header className="h-16 border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-white/10 text-zinc-400 hover:text-white">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
              Heatmap Analysis
              <Badge variant="outline" className="text-[10px] py-0 h-4 border-primary text-primary font-black uppercase tracking-tighter">Live</Badge>
            </h1>
            <span className="text-[10px] font-medium text-zinc-500 truncate max-w-[200px] md:max-w-md">{url}</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6">
           <div className="flex gap-2 items-center">
             <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Overlay Type</span>
             <Tabs value={activeType} onValueChange={(v: any) => setActiveType(v)} className="bg-black/40 p-1 rounded-lg border border-white/5">
                <TabsList className="h-8 bg-transparent p-0 gap-1">
                    <TabsTrigger value="click" className="h-6 px-3 text-[10px] font-bold uppercase rounded data-[state=active]:bg-primary data-[state=active]:text-white">
                        <MousePointerClick className="h-3 w-3 mr-1.5" /> Click
                    </TabsTrigger>
                    <TabsTrigger value="move" className="h-6 px-3 text-[10px] font-bold uppercase rounded data-[state=active]:bg-primary data-[state=active]:text-white">
                        <MousePointer2 className="h-3 w-3 mr-1.5" /> Move
                    </TabsTrigger>
                </TabsList>
              </Tabs>
           </div>

           <div className="h-8 w-px bg-white/5" />

           <div className="flex gap-2 items-center">
             <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Viewport</span>
             <Tabs value={device} onValueChange={(v: any) => setDevice(v)} className="bg-black/40 p-1 rounded-lg border border-white/5">
                <TabsList className="h-8 bg-transparent p-0 gap-1">
                    <TabsTrigger value="desktop" className="h-6 w-8 p-0 rounded data-[state=active]:bg-zinc-800"><Monitor className="h-3.5 w-3.5" /></TabsTrigger>
                    <TabsTrigger value="tablet" className="h-6 w-8 p-0 rounded data-[state=active]:bg-zinc-800"><Tablet className="h-3.5 w-3.5" /></TabsTrigger>
                    <TabsTrigger value="mobile" className="h-6 w-8 p-0 rounded data-[state=active]:bg-zinc-800"><Smartphone className="h-3.5 w-3.5" /></TabsTrigger>
                </TabsList>
              </Tabs>
           </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-col items-end mr-2">
             <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{isFreePlan || isDemo ? "Preview with dummy data" : "Live Mode"}</span>
             </div>
             <span className="text-[9px] text-zinc-500 font-bold uppercase">{points.length} samples loaded</span>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg bg-white/5 border-white/10 hover:bg-white/10"><Share2 className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg bg-white/5 border-white/10 hover:bg-white/10"><Download className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden bg-zinc-950 relative">
        {/* Floating Side Tools */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-40">
           <TooltipProvider>
             <div className="bg-zinc-900 shadow-2xl rounded-2xl p-2 border border-white/10 flex flex-col gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-10 w-10 text-zinc-500 hover:text-white hover:bg-white/5"><Layers className="h-5 w-5" /></Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Visibility</TooltipContent>
                </Tooltip>
                <div className="px-2 py-4">
                     <div className="h-[100px] flex flex-col items-center gap-2">
                        <span className="text-[8px] font-black uppercase text-zinc-600 vertical-text origin-center rotate-180">Opacity</span>
                        <div className="mt-2 h-full py-2">
                            <Slider 
                                orientation="vertical" 
                                value={opacity} 
                                onValueChange={setOpacity} 
                                max={100} 
                                step={5}
                                className="h-full"
                            />
                        </div>
                     </div>
                </div>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-10 w-10 text-zinc-500 hover:text-white hover:bg-white/5" onClick={() => setShowHeightControl(!showHeightControl)}><Ruler className="h-5 w-5" /></Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Page Height</TooltipContent>
                </Tooltip>
             </div>
           </TooltipProvider>

           {/* Stats Floating Card */}
           {/* <div className="bg-primary/10 backdrop-blur-md shadow-2xl rounded-2xl p-4 border border-primary/20 flex flex-col gap-4 mt-4 w-[160px]">
              <div className="space-y-1">
                 <span className="text-[9px] font-black uppercase tracking-widest text-primary/80">Interaction Density</span>
                 <div className="text-xl font-black">Medium</div>
              </div>
              <div className="space-y-1">
                 <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Avg. Pos</span>
                 <div className="text-sm font-bold text-zinc-400">Centered</div>
              </div>
              <div className="pt-2 border-t border-white/5">
                 <div className="flex items-center gap-2 text-[10px] text-primary font-bold">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified Data
                 </div>
              </div>
           </div> */}
        </div>

        <div className="flex-1 flex flex-col items-center justify-start overflow-hidden pt-5 pb-20 relative">
          <div 
            className="relative shadow-[0_0_100px_rgba(0,0,0,0.5)] transition-all duration-500 ease-out rounded-xl ring-1 ring-white/10"
            style={{ 
              width: `${deviceWidth}px`, 
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
            }}
          >
            {/* Mock Web Browser Chrome */}
            <div className="h-10 bg-zinc-800 rounded-t-xl border-b border-white/5 flex items-center px-4 gap-3 select-none">
               <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-500/30" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500/30" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/30" />
               </div>
               <div className="flex-1 bg-black/40 h-6 rounded-md flex items-center px-3 justify-between">
                  <span className="text-[10px] text-zinc-500 truncate font-mono">{siteUrl}</span>
                  <Maximize2 className="h-2.5 w-2.5 text-zinc-600" />
               </div>
            </div>

            <div 
               ref={mainScrollRef}
               onScroll={handleMainScroll}
               className="bg-white overflow-y-auto overflow-x-hidden rounded-b-xl hide-scrollbar"
               style={{ height: 'calc(100vh - 150px)' }}
            >
                <div style={{ height: `${dimensions.height}px`, width: '100%', position: 'relative' }}>
                    <HeatmapOverlay 
                        points={points} 
                        width={deviceWidth} 
                        height={dimensions.height}
                        totalWidth={dimensions.width}
                        totalHeight={dimensions.height}
                        scrollTop={scrollPos.top}
                        scrollLeft={scrollPos.left}
                        opacity={opacity[0] / 100}
                        type={activeType}
                    />
                    
                    {loading && (
                        <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center gap-4 text-zinc-900 backdrop-blur-sm">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <div className="flex flex-col items-center">
                                <span className="font-black uppercase tracking-widest text-xs">Assembling Map</span>
                                <span className="text-[10px] font-medium opacity-50">Calibrating interactive coordinates...</span>
                            </div>
                        </div>
                    )}

                    {iframeError && (
                        <div className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center gap-4 text-zinc-900">
                            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                                <Info className="h-8 w-8 text-amber-600" />
                            </div>
                            <div className="flex flex-col items-center text-center px-4">
                                <span className="font-black uppercase tracking-widest text-sm">Page Load Restricted</span>
                                <span className="text-xs text-zinc-600 mt-2 max-w-md">
                                  This page cannot be displayed in preview mode. The heatmap data is still being collected and can be viewed in the data table.
                                </span>
                                <Button onClick={() => setIframeError(false)} className="mt-4" size="sm">
                                  Retry
                                </Button>
                            </div>
                        </div>
                    )}

                    <iframe 
                        ref={iframeRef}
                        src={siteUrl}
                        onError={() => {
                          console.error('Iframe failed to load:', siteUrl);
                          setIframeError(true);
                        }}
                        onLoad={() => {
                          setIframeError(false);
                          console.log('Iframe loaded successfully:', siteUrl);
                        }}
                        sandbox={isSameOrigin ? 'allow-same-origin allow-scripts allow-forms' : undefined}
                        referrerPolicy="same-origin"
                        className="w-full h-full border-none pointer-events-none"
                    />
                </div>
            </div>
          </div>

          {showHeightControl && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-2 w-80 z-[60]">
               <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold">Manual Height Calibration</span>
               </div>
               <p className="text-[10px] text-zinc-400 mb-2">We couldn't automatically detect the page height. Adjust it manually to align the heatmap correctly.</p>
               <div className="space-y-2">
                 <div className="flex justify-between text-[10px] font-black uppercase text-zinc-500">
                    <span>Height</span>
                    <span>{dimensions.height}px</span>
                 </div>
                 <Slider 
                    value={[dimensions.height]} 
                    onValueChange={(v) => setDimensions({ ...dimensions, height: v[0] })}
                    min={500}
                    max={10000}
                    step={100}
                 />
               </div>
               <Button size="sm" className="mt-2 h-7 rounded text-[10px] font-black uppercase" onClick={() => setShowHeightControl(false)}>Dismiss</Button>
            </div>
          )}
        </div>
      </main>

      {/* Top Banner for Demo/Free */}
      {/* {(isFreePlan || isDemo) && (
        <div className="bg-amber-500 text-black py-1 px-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-4">
                <Sparkles className="h-3 w-3" />
                Preview Mode: Visualizing simulated user interactions for this domain
                <Link href={isDemo ? '/pricing' : `/websites/${websiteId}/billing`} className="underline ml-2">Upgrade for Live Tracking</Link>
            </p>
        </div>
      )} */}
    </div>
  );
}
