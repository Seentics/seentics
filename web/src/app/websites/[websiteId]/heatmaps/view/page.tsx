'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  MousePointerClick,
  MousePointer2,
  RefreshCcw,
  Monitor,
  Smartphone,
  Tablet,
  Download,
  Share2,
  Info,
  Loader2,
  Ruler,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Crosshair,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import HeatmapOverlay from '@/components/heatmap-overlay';
import api from '@/lib/api';
import { useSubscription } from '@/hooks/useSubscription';
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

  const { data: website, isLoading: isLoadingWebsite } = useQuery({
    queryKey: ['website', websiteId],
    queryFn: async () => {
      const response = await api.get(`/user/websites/${websiteId}`);
      return response.data?.data ?? response.data;
    },
    enabled: !!websiteId && websiteId !== 'demo',
  });

  const [activeType, setActiveType] = useState<'click' | 'move'>('click');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 2000 });
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [showHeightControl, setShowHeightControl] = useState(false);
  const [opacity, setOpacity] = useState([70]);
  const [isSameOrigin, setIsSameOrigin] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const normalizeUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return 'http://' + trimmed;
  };

  useEffect(() => {
    if (!website?.url) return;
    try {
      const currentHostname = window.location.hostname;
      const targetUrl = new URL(normalizeUrl(website.url));
      setIsSameOrigin(currentHostname === targetUrl.hostname);
    } catch {
      setIsSameOrigin(false);
    }
  }, [website?.url]);

  const isDemo = websiteId === 'demo';
  const isFreePlan = subscription?.plan === 'free';
  const showDummy = isDemo || isFreePlan;

  // Listen for messages from the tracker script in the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && event.data.type?.startsWith('SEENTICS_')) {
        console.log('[HeatmapView] Received message:', event.data);
      }
      if (event.data?.type === 'SEENTICS_DIMENSIONS') {
        const { height } = event.data;
        if (height && height > 0) {
          setDimensions(prev => prev.height !== height ? { ...prev, height } : prev);
          setShowHeightControl(false);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Periodically request dimensions from the iframe
  useEffect(() => {
    if (isDemo) {
      setDimensions({ width: 1200, height: 4000 });
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
      const centerX = Math.random() * 900 + 50;
      const centerY = Math.random() * 2000 + 100;
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
        const response = await api.get(`/heatmaps/data?website_id=${websiteId}&url=${encodeURIComponent(url)}&type=${activeType}`);
        const rawPoints = response.data.points || [];
        const mappedPoints = rawPoints.map((p: any) => ({
          ...p,
          x: p.x_percent ?? p.x,
          y: p.y_percent ?? p.y
        }));
        setPoints(mappedPoints);
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
  }, [device, loading, showPanel]);

  const getDeviceWidth = () => {
    if (device === 'mobile') return 375;
    if (device === 'tablet') return 768;
    return 1200;
  };

  const getDeviceScale = () => {
    if (viewSize.width === 0) return 1;
    const targetWidth = getDeviceWidth();
    const available = viewSize.width - 80;
    if (available > targetWidth) return 1;
    return available / targetWidth;
  };

  const deviceWidth = getDeviceWidth();
  const scale = getDeviceScale();

  const buildIframeUrl = () => {
    if (isDemo) return 'https://seentics.com';
    if (!website?.url) return '';
    const baseUrl = normalizeUrl(website.url).replace(/\/$/, '');
    const fullPath = url.startsWith('/') ? url : `/${url}`;
    const targetUrl = `${baseUrl}${fullPath}`;
    try {
      const targetHostname = new URL(targetUrl).hostname;
      const currentHostname = window.location.hostname;
      if (targetHostname === currentHostname) return fullPath;
    } catch {
      return '';
    }
    return targetUrl;
  };

  const siteUrl = buildIframeUrl();

  const densityLabel = points.length > 500 ? 'High' : points.length > 100 ? 'Medium' : points.length > 0 ? 'Low' : 'None';

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden select-none">
      {/* Header */}
      <header className="h-12 border-b border-white/[0.06] bg-zinc-900/80 backdrop-blur-xl flex items-center justify-between px-4 z-50 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 hover:bg-white/10 text-zinc-400 hover:text-white flex-shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-white truncate">Heatmap Analysis</span>
            <Badge variant="outline" className="text-[9px] py-0 h-4 border-emerald-500/40 text-emerald-400 font-medium flex-shrink-0">
              {showDummy ? 'Preview' : 'Live'}
            </Badge>
          </div>
          <span className="text-xs text-zinc-500 truncate max-w-[160px] md:max-w-sm hidden sm:block">{url}</span>
        </div>

        {/* Center: Device & Type (hidden on small screens, shown in panel) */}
        <div className="hidden lg:flex items-center gap-1 bg-zinc-800/60 rounded-lg p-0.5 border border-white/[0.06]">
          <TypeButton active={activeType === 'click'} onClick={() => setActiveType('click')} icon={MousePointerClick} label="Clicks" />
          <TypeButton active={activeType === 'move'} onClick={() => setActiveType('move')} icon={MousePointer2} label="Movement" />
          <div className="w-px h-5 bg-white/10 mx-0.5" />
          <DeviceButton active={device === 'desktop'} onClick={() => setDevice('desktop')} icon={Monitor} label="Desktop" />
          <DeviceButton active={device === 'tablet'} onClick={() => setDevice('tablet')} icon={Tablet} label="Tablet" />
          <DeviceButton active={device === 'mobile'} onClick={() => setDevice('mobile')} icon={Smartphone} label="Mobile" />
        </div>

        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => setShowOverlay(!showOverlay)}>
                  {showOverlay ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showOverlay ? 'Hide overlay' : 'Show overlay'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10">
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="w-px h-5 bg-white/10 mx-0.5" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => setShowPanel(!showPanel)}>
                  {showPanel ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showPanel ? 'Hide panel' : 'Show panel'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Premium banner */}
      {(isFreePlan || isDemo) && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-1.5 px-4 flex items-center justify-center gap-3">
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span className="text-xs text-amber-400/90">Preview mode — showing simulated data</span>
          <Link href={isDemo ? '/pricing' : `/websites/${websiteId}/billing`} className="text-xs text-amber-400 underline underline-offset-2 hover:text-amber-300">
            Upgrade
          </Link>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Preview area */}
        <div ref={containerRef} className="flex-1 overflow-hidden flex items-start justify-center pt-6 pb-6 relative">
          <div
            className="relative transition-all duration-300 ease-out rounded-xl overflow-hidden"
            style={{
              width: `${deviceWidth}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 25px 80px rgba(0,0,0,0.5)',
            }}
          >
            {/* Browser chrome */}
            <div className="h-9 bg-zinc-800/90 border-b border-white/[0.06] flex items-center px-3.5 gap-3 select-none">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-600/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-600/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-600/60" />
              </div>
              <div className="flex-1 bg-zinc-900/80 h-5.5 rounded flex items-center px-3 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 truncate font-mono">{siteUrl}</span>
              </div>
            </div>

            {/* Content */}
            <div
              ref={mainScrollRef}
              className="bg-white overflow-y-auto overflow-x-hidden hide-scrollbar"
              style={{ height: 'calc(100vh - 140px)' }}
            >
              <div style={{ height: `${Math.max(dimensions.height, 2000)}px`, width: `${deviceWidth}px`, position: 'relative' }}>
                {showOverlay && (
                  <HeatmapOverlay
                    points={points}
                    width={deviceWidth}
                    height={Math.max(dimensions.height, 2000)}
                    totalWidth={deviceWidth}
                    totalHeight={Math.max(dimensions.height, 2000)}
                    opacity={opacity[0] / 100}
                    type={activeType}
                  />
                )}

                {loading || isLoadingWebsite ? (
                  <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-medium text-zinc-700">Loading heatmap data</span>
                      <span className="text-xs text-zinc-400 mt-0.5">Mapping interaction coordinates...</span>
                    </div>
                  </div>
                ) : iframeError ? (
                  <div className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
                      <Info className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex flex-col items-center text-center px-4">
                      <span className="text-sm font-medium text-zinc-800">Unable to load page preview</span>
                      <span className="text-xs text-zinc-500 mt-1 max-w-sm">
                        The target website may be blocking iframe embeds. The heatmap data is still displayed.
                      </span>
                      <Button onClick={() => setIframeError(false)} className="mt-3" size="sm" variant="outline">
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : !points || points.length === 0 ? (
                  <div className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center gap-2">
                    <Crosshair className="h-8 w-8 text-zinc-300" />
                    <span className="text-sm font-medium text-zinc-400">No data points recorded</span>
                    <span className="text-xs text-zinc-400">Waiting for user interactions on this page.</span>
                  </div>
                ) : null}

                {siteUrl && (
                  <iframe
                    ref={iframeRef}
                    src={siteUrl}
                    onError={() => {
                      console.error('Iframe failed to load:', siteUrl);
                      setIframeError(true);
                    }}
                    onLoad={(e) => {
                      setIframeError(false);
                      const validIframe = e.currentTarget;
                      const scanHeight = () => {
                        if (!validIframe.contentWindow) return;
                        try {
                          const doc = validIframe.contentWindow.document;
                          const bodyHeight = Math.max(
                            doc.body.scrollHeight, doc.body.offsetHeight,
                            doc.documentElement.clientHeight, doc.documentElement.scrollHeight, doc.documentElement.offsetHeight
                          );
                          let maxInnerHeight = bodyHeight;
                          const scrollables = doc.querySelectorAll('div, main, section');
                          for (let i = 0; i < scrollables.length; i++) {
                            const el = scrollables[i] as Element;
                            if (el.scrollHeight > maxInnerHeight) {
                              const style = (validIframe.contentWindow as Window).getComputedStyle(el);
                              if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && style.display !== 'none') {
                                maxInnerHeight = el.scrollHeight;
                              }
                            }
                          }
                          if (maxInnerHeight > 0) {
                            setDimensions(prev => ({ ...prev, height: maxInnerHeight }));
                            setShowHeightControl(false);
                          }
                        } catch {
                          // Cross-origin — fall through to postMessage polling
                        }
                      };
                      scanHeight();
                      setTimeout(scanHeight, 1500);
                      setTimeout(scanHeight, 3000);
                      let attempts = 0;
                      const poller = setInterval(() => {
                        if (validIframe.contentWindow) {
                          validIframe.contentWindow.postMessage('SEENTICS_GET_DIMENSIONS', '*');
                          attempts++;
                          if (attempts > 10) clearInterval(poller);
                        } else {
                          clearInterval(poller);
                        }
                      }, 500);
                    }}
                    referrerPolicy="same-origin"
                    className="absolute inset-0 w-full h-full border-none pointer-events-none"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Height calibration popup */}
          {showHeightControl && (
            <div className="fixed bottom-14 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 rounded-xl p-4 shadow-2xl w-72 z-[60]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Ruler className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-xs font-medium">Height Calibration</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-white" onClick={() => {
                  if (iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage('SEENTICS_GET_DIMENSIONS', '*');
                  }
                }}>
                  <RefreshCcw className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-[10px] text-zinc-500 mb-3">Auto-detection incomplete. Adjust manually if needed.</p>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Height</span>
                  <span className="font-mono">{dimensions.height}px</span>
                </div>
                <Slider
                  value={[dimensions.height]}
                  onValueChange={(v) => setDimensions({ ...dimensions, height: v[0] })}
                  min={500}
                  max={10000}
                  step={100}
                />
              </div>
              <Button size="sm" variant="outline" className="mt-3 w-full h-7 text-xs border-white/10 text-zinc-300 hover:bg-white/5" onClick={() => setShowHeightControl(false)}>
                Done
              </Button>
            </div>
          )}
        </div>

        {/* Right sidebar panel */}
        {showPanel && (
          <aside className="w-[260px] border-l border-white/[0.06] bg-zinc-900/50 flex flex-col flex-shrink-0 overflow-y-auto hide-scrollbar">
            {/* Mobile-only controls (type & device shown here on small screens) */}
            <div className="lg:hidden p-4 space-y-4 border-b border-white/[0.06]">
              <PanelSection title="Overlay Type">
                <div className="flex gap-1.5">
                  <TypeButton active={activeType === 'click'} onClick={() => setActiveType('click')} icon={MousePointerClick} label="Clicks" />
                  <TypeButton active={activeType === 'move'} onClick={() => setActiveType('move')} icon={MousePointer2} label="Movement" />
                </div>
              </PanelSection>
              <PanelSection title="Device">
                <div className="flex gap-1.5">
                  <DeviceButton active={device === 'desktop'} onClick={() => setDevice('desktop')} icon={Monitor} label="Desktop" />
                  <DeviceButton active={device === 'tablet'} onClick={() => setDevice('tablet')} icon={Tablet} label="Tablet" />
                  <DeviceButton active={device === 'mobile'} onClick={() => setDevice('mobile')} icon={Smartphone} label="Mobile" />
                </div>
              </PanelSection>
            </div>

            {/* Opacity */}
            <div className="p-4 border-b border-white/[0.06]">
              <PanelSection title="Opacity">
                <div className="flex items-center gap-3">
                  <Slider
                    value={opacity}
                    onValueChange={setOpacity}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-xs text-zinc-400 font-mono w-8 text-right">{opacity[0]}%</span>
                </div>
              </PanelSection>
            </div>

            {/* Color scale legend */}
            <div className="p-4 border-b border-white/[0.06]">
              <PanelSection title="Color Scale">
                <div className="space-y-2">
                  <div className="h-2.5 w-full rounded-full overflow-hidden" style={{
                    background: 'linear-gradient(to right, rgba(59,130,246,0.8), rgba(34,211,238,0.8), rgba(163,230,53,0.8), rgba(250,204,21,0.8), rgba(239,68,68,0.9))'
                  }} />
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                  </div>
                </div>
              </PanelSection>
            </div>

            {/* Statistics */}
            <div className="p-4 border-b border-white/[0.06]">
              <PanelSection title="Statistics">
                <div className="space-y-2.5">
                  <StatRow label="Data Points" value={points.length.toLocaleString()} />
                  <StatRow label="Overlay" value={activeType === 'click' ? 'Click map' : 'Movement map'} />
                  <StatRow label="Density" value={densityLabel} />
                  <StatRow label="Viewport" value={`${deviceWidth}px`} />
                  <StatRow label="Page Height" value={`${dimensions.height}px`} />
                </div>
              </PanelSection>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-2">
              <PanelSection title="Tools">
                <div className="space-y-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 text-xs text-zinc-400 hover:text-white hover:bg-white/5 gap-2"
                    onClick={() => setShowOverlay(!showOverlay)}
                  >
                    {showOverlay ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showOverlay ? 'Hide Overlay' : 'Show Overlay'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 text-xs text-zinc-400 hover:text-white hover:bg-white/5 gap-2"
                    onClick={() => setShowHeightControl(!showHeightControl)}
                  >
                    <Ruler className="h-3.5 w-3.5" />
                    Adjust Height
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 text-xs text-zinc-400 hover:text-white hover:bg-white/5 gap-2"
                    onClick={() => {
                      setLoading(true);
                      setTimeout(() => setLoading(false), 300);
                    }}
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Refresh Data
                  </Button>
                </div>
              </PanelSection>
            </div>
          </aside>
        )}
      </div>

      {/* Status bar */}
      <footer className="h-7 border-t border-white/[0.06] bg-zinc-900/60 flex items-center px-4 gap-4 text-[10px] text-zinc-500 flex-shrink-0 z-50">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", showDummy ? "bg-amber-500" : "bg-emerald-500 animate-pulse")} />
          <span>{showDummy ? 'Preview Mode' : 'Live'}</span>
        </div>
        <div className="h-3 w-px bg-white/10" />
        <span>{points.length.toLocaleString()} data points</span>
        <div className="h-3 w-px bg-white/10" />
        <span className="capitalize">{device} &middot; {deviceWidth}×{dimensions.height}px</span>
        <div className="flex-1" />
        <span className="hidden sm:block">
          {activeType === 'click' ? 'Click' : 'Movement'} heatmap &middot; {opacity[0]}% opacity
        </span>
      </footer>
    </div>
  );
}

// --- Sub-components ---

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{title}</span>
      {children}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-300 font-medium">{value}</span>
    </div>
  );
}

function TypeButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
        active
          ? "bg-white/10 text-white"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function DeviceButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "flex items-center justify-center h-6 w-7 rounded-md transition-all",
              active
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
