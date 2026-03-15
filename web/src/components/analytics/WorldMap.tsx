'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface TopItem {
    name: string;
    code?: string;
    count: number;
    percentage: number;
}

interface WorldMapProps {
    data: TopItem[];
    isLoading?: boolean;
    view?: 'globe' | 'flat';
}

const COUNTRY_COORDS: Record<string, [number, number]> = {
    'United States': [37.09, -95.71], 'United Kingdom': [55.38, -3.44],
    'Germany': [51.17, 10.45], 'France': [46.23, 2.21], 'India': [20.59, 78.96],
    'China': [35.86, 104.19], 'Brazil': [-14.24, -51.93], 'Canada': [56.13, -106.35],
    'Australia': [-25.27, 133.78], 'Japan': [36.2, 138.25], 'Russia': [61.52, 105.32],
    'South Korea': [35.91, 127.77], 'Italy': [41.87, 12.57], 'Spain': [40.46, -3.75],
    'Mexico': [23.63, -102.55], 'Indonesia': [-0.79, 113.92], 'Netherlands': [52.13, 5.29],
    'Turkey': [38.96, 35.24], 'Saudi Arabia': [23.89, 45.08], 'Switzerland': [46.82, 8.23],
    'Argentina': [-38.42, -63.62], 'Poland': [51.92, 19.15], 'Sweden': [60.13, 18.64],
    'Belgium': [50.50, 4.47], 'Norway': [60.47, 8.47], 'Austria': [47.52, 14.55],
    'United Arab Emirates': [23.42, 53.85], 'Nigeria': [9.08, 8.68],
    'South Africa': [-30.56, 22.94], 'Egypt': [26.82, 30.80], 'Pakistan': [30.38, 69.35],
    'Bangladesh': [23.68, 90.36], 'Philippines': [12.88, 121.77], 'Vietnam': [14.06, 108.28],
    'Thailand': [15.87, 100.99], 'Malaysia': [4.21, 101.98], 'Singapore': [1.35, 103.82],
    'New Zealand': [-40.90, 174.89], 'Portugal': [39.40, -8.22], 'Czech Republic': [49.82, 15.47],
    'Romania': [45.94, 24.97], 'Hungary': [47.16, 19.50], 'Greece': [39.07, 21.82],
    'Israel': [31.05, 34.85], 'Denmark': [56.26, 9.50], 'Finland': [61.92, 25.75],
    'Ireland': [53.41, -8.24], 'Chile': [-35.68, -71.54], 'Colombia': [4.57, -74.30],
    'Peru': [-9.19, -75.02], 'Ukraine': [48.38, 31.17], 'Taiwan': [23.7, 121.0],
    'Hong Kong': [22.32, 114.17], 'Kenya': [-0.02, 37.91], 'Morocco': [31.79, -7.09],
    'Algeria': [28.03, 1.66], 'Iran': [32.42, 53.69], 'Iraq': [33.22, 43.68],
    'Jordan': [30.59, 36.24], 'Kuwait': [29.31, 47.48], 'Qatar': [25.35, 51.18],
    'Sri Lanka': [7.87, 80.77], 'Nepal': [28.39, 84.12], 'Cambodia': [12.57, 104.99],
    'Ghana': [7.95, -1.02], 'Croatia': [45.10, 15.20], 'Slovakia': [48.67, 19.70],
    'Bulgaria': [42.73, 25.49], 'Belarus': [53.71, 27.95], 'Kazakhstan': [48.02, 66.92],
    'Venezuela': [6.42, -66.59], 'Ecuador': [-1.83, -78.18],
};

// TopoJSON uses different country names than the GeoIP/API names.
// Map lowercase TopoJSON names → lowercase API names so choropleth matches.
const TOPO_NAME_MAP: Record<string, string> = {
    'united states of america': 'united states',
    'russian federation': 'russia',
    'viet nam': 'vietnam',
    'czechia': 'czech republic',
    "korea, republic of": 'south korea',
    "democratic people's republic of korea": 'north korea',
    "taiwan, province of china": 'taiwan',
    'lao pdr': 'laos',
    'myanmar': 'myanmar',
    'côte d\'ivoire': 'ivory coast',
    'democratic republic of the congo': 'dr congo',
    'republic of the congo': 'congo',
    'united republic of tanzania': 'tanzania',
    'iran (islamic republic of)': 'iran',
    'syrian arab republic': 'syria',
    'libyan arab jamahiriya': 'libya',
    'bolivia (plurinational state of)': 'bolivia',
    'venezuela (bolivarian republic of)': 'venezuela',
    'moldova, republic of': 'moldova',
    'macedonia, the former yugoslav republic of': 'north macedonia',
};

const PRIMARY_RGB = '82,67,244'; // #5243f4 — matches app primary

function pinColor(ratio: number) {
    const alpha = 0.5 + ratio * 0.5;
    return {
        bg: `rgba(${PRIMARY_RGB},${alpha.toFixed(2)})`,
        ring: `rgba(${PRIMARY_RGB},0.25)`,
        glow: `rgba(${PRIMARY_RGB},0.2)`,
    };
}

function choroplethColor(ratio: number): string {
    if (ratio >= 0.75) return '#3324b3';
    if (ratio >= 0.5)  return '#3d2dd4';
    if (ratio >= 0.25) return '#5243f4';
    if (ratio >= 0.08) return '#a29bfa';
    return '#e8e6fe';
}

// ── 3D Globe ─────────────────────────────────────────────────────────────────
function GlobeView({ data }: { data: TopItem[] }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const globeRef = useRef<any>(null);
    const [dims, setDims] = useState({ w: 0, h: 0 });
    const [GlobeComponent, setGlobeComponent] = useState<any>(null);
    const [ready, setReady] = useState(false);
    const [canvasBg, setCanvasBg] = useState('rgba(0,0,0,0)');

    useEffect(() => {
        import('react-globe.gl').then(mod => setGlobeComponent(() => mod.default));
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;
        // Read computed card bg so globe bg matches exactly
        const computed = getComputedStyle(containerRef.current).backgroundColor;
        if (computed && computed !== 'rgba(0, 0, 0, 0)') setCanvasBg(computed);

        const obs = new ResizeObserver(entries => {
            for (const e of entries) {
                const { width, height } = e.contentRect;
                if (width > 0 && height > 0) setDims({ w: Math.floor(width), h: Math.floor(height) });
            }
        });
        obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    const maxPct = useMemo(() => Math.max(...data.map(d => d.percentage), 0.001), [data]);

    const htmlMarkers = useMemo(() =>
        data.flatMap(item => {
            const coords = COUNTRY_COORDS[item.name];
            if (!coords) return [];
            const ratio = item.percentage / maxPct;
            const dotSize = Math.round(22 + ratio * 20);
            const fontSize = Math.round(8 + ratio * 4);
            const { bg, ring, glow } = pinColor(ratio);
            const countLabel = item.count > 999 ? `${(item.count / 1000).toFixed(1)}k` : `${item.count}`;
            const escapedName = item.name.replace(/"/g, '&quot;');
            const pctLabel = item.percentage > 0 ? item.percentage.toFixed(2) + '%' : '';
            return [{
                lat: coords[0], lng: coords[1], altitude: 0.02,
                name: item.name, count: item.count, percentage: item.percentage,
                __html: `<div style="position:relative;display:inline-block;">
                    <div data-name="${escapedName}" data-count="${item.count}" data-pct="${item.percentage.toFixed(2)}"
                         style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${bg};
                                border:2px solid ${ring};box-shadow:0 0 0 4px ${glow},0 2px 8px rgba(0,0,0,0.5);
                                display:flex;align-items:center;justify-content:center;
                                cursor:pointer;transition:transform 0.15s;font-family:system-ui,sans-serif">
                        <span style="color:#fff;font-size:${fontSize}px;font-weight:700;line-height:1;text-align:center">${countLabel}</span>
                    </div>
                    <div class="sn-globe-tip" style="display:none;position:absolute;bottom:calc(100% + 8px);left:50%;
                         transform:translateX(-50%);white-space:nowrap;
                         background:rgba(10,10,20,0.92);color:#fff;padding:5px 10px;
                         border-radius:7px;font-size:11px;font-family:system-ui,sans-serif;
                         border:1px solid rgba(255,255,255,0.12);pointer-events:none;z-index:99999;
                         box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                        <div style="font-weight:700;margin-bottom:2px;">${escapedName}</div>
                        <div style="opacity:0.7;">${item.count.toLocaleString()} visitors${pctLabel ? ' · ' + pctLabel : ''}</div>
                    </div>
                </div>`,
            }];
        }), [data, maxPct]);

    const rings = useMemo(() =>
        data.flatMap(item => {
            const coords = COUNTRY_COORDS[item.name];
            if (!coords) return [];
            const ratio = item.percentage / maxPct;
            const { bg } = pinColor(ratio);
            return [{ lat: coords[0], lng: coords[1], maxR: 2.5 + ratio * 2.8,
                propagationSpeed: 1.3, repeatPeriod: 1000 + (1-ratio)*1200, color: bg }];
        }), [data, maxPct]);

    useEffect(() => {
        if (!ready || !globeRef.current) return;
        const ctrl = globeRef.current.controls();
        if (ctrl) {
            ctrl.autoRotate = true; ctrl.autoRotateSpeed = 0.3;
            ctrl.enableZoom = true; ctrl.minDistance = 180; ctrl.maxDistance = 700;
        }
        globeRef.current.pointOfView({ lat: 20, lng: 10, altitude: 1.85 }, 0);
    }, [ready]);

    return (
        <div ref={containerRef} className="w-full h-full relative">
            {GlobeComponent && dims.w > 0 && (
                <GlobeComponent
                    ref={globeRef}
                    width={dims.w} height={dims.h}
                    backgroundColor={canvasBg}
                    globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                    bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                    atmosphereColor="#7a6ef7"
                    atmosphereAltitude={0.18}
                    htmlElementsData={htmlMarkers}
                    htmlLat="lat" htmlLng="lng" htmlAltitude="altitude"
                    htmlElement={(d: any) => {
                        const el = document.createElement('div');
                        el.innerHTML = d.__html;
                        // circle = the blue dot; tip = the built-in label
                        const circle = el.querySelector('[data-name]') as HTMLElement | null;
                        const tip = el.querySelector('.sn-globe-tip') as HTMLElement | null;
                        if (circle) {
                            circle.addEventListener('mouseenter', () => {
                                circle.style.transform = 'scale(1.3)';
                                if (tip) tip.style.display = 'block';
                            });
                            circle.addEventListener('mouseleave', () => {
                                circle.style.transform = 'scale(1)';
                                if (tip) tip.style.display = 'none';
                            });
                            circle.addEventListener('click', (e) => {
                                e.stopPropagation();
                                if (!tip) return;
                                const isVisible = tip.style.display === 'block';
                                tip.style.display = isVisible ? 'none' : 'block';
                                circle.style.transform = isVisible ? 'scale(1)' : 'scale(1.3)';
                            });
                            circle.addEventListener('touchstart', (e) => {
                                e.stopPropagation();
                                if (!tip) return;
                                const isVisible = tip.style.display === 'block';
                                tip.style.display = isVisible ? 'none' : 'block';
                                circle.style.transform = isVisible ? 'scale(1)' : 'scale(1.3)';
                            }, { passive: true });
                        }
                        return el;
                    }}
                    ringsData={rings}
                    ringLat="lat" ringLng="lng" ringMaxRadius="maxR"
                    ringPropagationSpeed="propagationSpeed" ringRepeatPeriod="repeatPeriod"
                    ringColor="color" ringResolution={72}
                    onGlobeReady={() => setReady(true)}
                />
            )}
        </div>
    );
}

// ── 2D Flat Choropleth ────────────────────────────────────────────────────────
function FlatMapView({ data }: { data: TopItem[] }) {
    const [tooltip, setTooltip] = useState<{ name: string; count: number; percentage: number } | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('dark'));
        check();
        const obs = new MutationObserver(check);
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);

    const noDataFill   = isDark ? '#2d3748' : '#d1d5db';
    const borderStroke = isDark ? '#1a202c' : '#ffffff';

    const countryMap = useMemo(() => {
        const m: Record<string, TopItem> = {};
        data.forEach(d => { m[d.name.toLowerCase()] = d; });
        return m;
    }, [data]);

    const maxPct = useMemo(() => Math.max(...data.map(d => d.percentage), 0.001), [data]);

    return (
        <div className="relative w-full h-full">
            <ComposableMap
                projectionConfig={{ scale: 280, center: [0, 15] }}
                style={{ width: '100%', height: '100%' }}
            >
                <ZoomableGroup zoom={1} minZoom={1} maxZoom={8}>
                    <Geographies geography={GEO_URL}>
                        {({ geographies }) =>
                            geographies.map(geo => {
                                const name: string = geo.properties?.name ?? '';
                                const apiName = TOPO_NAME_MAP[name.toLowerCase()] ?? name.toLowerCase();
                                const item = countryMap[apiName];
                                const ratio = item ? item.percentage / maxPct : 0;
                                const fill = item ? choroplethColor(ratio) : noDataFill;
                                return (
                                    <Geography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        fill={fill}
                                        stroke={borderStroke}
                                        strokeWidth={0.5}
                                        style={{
                                            default: { outline: 'none' },
                                            hover: { outline: 'none', filter: 'brightness(0.88)' },
                                            pressed: { outline: 'none' },
                                        }}
                                        onMouseEnter={e => {
                                            if (item) { setTooltip({ name, count: item.count, percentage: item.percentage }); setTooltipPos({ x: e.clientX, y: e.clientY }); }
                                        }}
                                        onMouseMove={e => { if (item) setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                                        onMouseLeave={() => setTooltip(null)}
                                    />
                                );
                            })
                        }
                    </Geographies>
                </ZoomableGroup>
            </ComposableMap>

            {tooltip && (
                <div className="fixed z-50 pointer-events-none bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs"
                    style={{ left: tooltipPos.x + 14, top: tooltipPos.y - 52 }}>
                    <div className="font-semibold">{tooltip.name}</div>
                    <div className="text-muted-foreground mt-0.5">{tooltip.count.toLocaleString()} visitors · {tooltip.percentage.toFixed(2)}%</div>
                </div>
            )}
        </div>
    );
}

// ── Legend ────────────────────────────────────────────────────────────────────
function Legend() {
    return (
        <div className="absolute bottom-3 left-3 flex flex-col gap-1.5 bg-background/90 backdrop-blur-md border border-border/50 rounded-lg px-3 py-2.5 text-[10px]">
            <div className="font-semibold text-foreground mb-0.5 text-[11px]">Traffic share</div>
            {[
                { bg: '#e8e6fe', label: '< 8%' },
                { bg: '#a29bfa', label: '8–25%' },
                { bg: '#5243f4', label: '25–50%' },
                { bg: '#3d2dd4', label: '50–75%' },
                { bg: '#3324b3', label: '> 75%' },
            ].map(({ bg, label }) => (
                <div key={label} className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: bg }} />
                    {label}
                </div>
            ))}
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function WorldMap({ data, isLoading, view = 'globe' }: WorldMapProps) {
    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="relative w-full h-full rounded-xl overflow-hidden">
            {view === 'globe' ? <GlobeView data={data} /> : <FlatMapView data={data} />}
            <Legend />
            {data.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-muted-foreground/40 text-sm">No geographic data yet</p>
                </div>
            )}
        </div>
    );
}
