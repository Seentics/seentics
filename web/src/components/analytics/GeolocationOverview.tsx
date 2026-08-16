'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Globe, MapPin } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useState } from 'react';
import { getCountryFlag } from '@/utils/countries';

// Dynamically import WorldMap to avoid SSR issues
const WorldMap = dynamic(() => import('./WorldMap'), {
    ssr: false,
    loading: () => (
        <div className="h-[400px] rounded-lg flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-lg-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
        </div>
    )
});

interface TopItem {
    name: string;
    code?: string;
    count: number;
    percentage: number;
}

interface GeolocationData {
    countries: TopItem[];
    continents: TopItem[];
    regions: TopItem[];
    cities: TopItem[];
}

interface GeolocationOverviewProps {
    data?: GeolocationData;
    isLoading?: boolean;
    className?: string;
    onFilter?: (filter: Record<string, string>) => void;
}

export function GeolocationOverview({ data, isLoading = false, className = '', onFilter }: GeolocationOverviewProps) {
    const [geoTab, setGeoTab] = useState<string>('map2d');

    const displayData = data;
    const hasGeoBreakdown =
        (displayData?.countries?.length ?? 0) > 0 || (displayData?.cities?.length ?? 0) > 0;

    const getContinentEmoji = (continent: string): string => {
        const continentMap: Record<string, string> = {
            'North America': '🌎',
            'South America': '🌎',
            'Europe': '🌍',
            'Asia': '🌏',
            'Africa': '🌍',
            'Australia': '🌏',
            'Oceania': '🌏',
            'Antarctica': '🧊'
        };
        return continentMap[continent] || '🌍';
    };

    if (isLoading) {
        return (
            <Card className={cn("border-none bg-card shadow-sm rounded-lg overflow-hidden mb-6", className)}>
                <CardHeader>
                    <div className="animate-pulse space-y-2">
                        <div className="h-6 bg-accent/10 rounded-lg w-48 mb-2"></div>
                        <div className="h-4 bg-accent/10 rounded-lg w-64"></div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="animate-pulse h-[600px] bg-accent/5 rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("border-none bg-card shadow-sm overflow-hidden", className)}>
            <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-border/40">
                <div className="space-y-1">
                    <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                        Geographic Intelligence
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Visitor distribution across global regions</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Tabs value={geoTab} onValueChange={setGeoTab}>
                        <TabsList className="h-8 bg-muted/50 p-0.5 rounded-lg gap-0.5 flex-wrap">
                            <TabsTrigger className='h-7 text-xs font-medium px-3 rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm' value="map2d">2D map</TabsTrigger>
                            <TabsTrigger className='h-7 text-xs font-medium px-3 rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm' value="map3d">3D map</TabsTrigger>
                            <TabsTrigger className='h-7 text-xs font-medium px-3 rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm' value="countries">Countries</TabsTrigger>
                            <TabsTrigger className='h-7 text-xs font-medium px-3 rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm' value="cities">Cities</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>
            <CardContent className=" pt-2">
                <div className="min-h-[400px]">
                    {!hasGeoBreakdown && !isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center  rounded-lg border border-dashed border-border/60">
                            <Globe className="h-14 w-14 mb-4 text-muted-foreground/25" />
                            <p className="text-sm font-medium text-muted-foreground mb-1">No geographic data yet</p>
                            <p className="text-xs text-muted-foreground/80 max-w-sm leading-relaxed">
                                Needs recent <span className="font-medium text-foreground/85">pageviews</span>. In development, private/docker client IPs default to <span className="font-medium text-foreground/85">BD</span> on the map; set{' '}
                                <code className="text-[11px] bg-muted/80 px-1 rounded-lg">GEO_FALLBACK_COUNTRY=US</code> (etc.) if you want a different fallback.
                            </p>
                        </div>
                    ) : (
                        <>
                    {geoTab === 'map2d' && (
                        <div className="h-[460px] rounded-lg overflow-hidden ">
                            <WorldMap
                                data={displayData?.countries || []}
                                isLoading={isLoading}
                                view="flat"
                                showLegend
                            />
                        </div>
                    )}

                    {geoTab === 'map3d' && (
                        <div className="h-[460px] rounded-lg overflow-hidden ">
                            <WorldMap
                                data={displayData?.countries || []}
                                isLoading={isLoading}
                                view="globe"
                                showLegend
                            />
                        </div>
                    )}

                    {geoTab === 'countries' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                            {displayData?.countries?.slice(0, 14).map((country, index) => (
                                <div key={country.name} className={cn("flex items-center justify-between py-3 border-b border-border/40 hover:bg-accent/5 transition-colors group px-1", onFilter && "cursor-pointer")} onClick={() => onFilter?.({ country: country.name })}>
                                    <div className="flex items-center gap-4 min-w-0">
                                        <span className="text-[10px] font-bold text-muted-foreground/30 w-4">{(index + 1).toString().padStart(2, '0')}</span>
                                        <div className="relative w-8 h-6 rounded-lg-sm overflow-hidden shadow-sm border border-border/40">
                                            <Image
                                                src={getCountryFlag(country.name)}
                                                alt={`${country.name} flag`}
                                                fill
                                                className="object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    const fallback = target.parentElement?.querySelector('.flag-fallback') as HTMLElement;
                                                    if (fallback) fallback.style.display = 'flex';
                                                }}
                                            />
                                            <div className="flag-fallback hidden absolute inset-0 bg-accent rounded-lg-sm text-[8px] font-bold items-center justify-center">
                                                {country.name.substring(0, 2).toUpperCase()}
                                            </div>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-sm leading-tight text-foreground truncate group-hover:text-primary transition-colors">{country.name}</p>
                                            <p className="text-xs text-muted-foreground">{country.percentage.toFixed(1)}% of Traffic</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-sm leading-tight text-foreground">{(country.count || 0).toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">Visitors</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {geoTab === 'cities' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                            {(!displayData?.cities?.length) && (
                                <div className="col-span-2 flex flex-col items-center justify-center py-16 text-center">
                                    <MapPin className="h-10 w-10 mb-3 text-muted-foreground/25" />
                                    <p className="text-sm font-medium text-muted-foreground mb-1">No city data yet</p>
                                    <p className="text-xs text-muted-foreground/70 max-w-xs leading-relaxed">
                                        City-level resolution requires the MaxMind GeoIP database or Cloudflare city headers. New pageviews will populate this tab going forward.
                                    </p>
                                </div>
                            )}
                            {displayData?.cities?.slice(0, 14).map((city, index) => (
                                <div key={city.name} className="flex items-center justify-between py-3 border-b border-border/40 hover:bg-accent/5 transition-colors group px-1">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <span className="text-[10px] font-bold text-muted-foreground/30 w-4">{(index + 1).toString().padStart(2, '0')}</span>
                                        {city.code ? (
                                            <div className="relative w-8 h-6 rounded-lg-sm overflow-hidden shadow-sm border border-border/40">
                                                <Image
                                                    src={`/images/country/${city.code.toLowerCase()}.png`}
                                                    alt={`${city.code} flag`}
                                                    fill
                                                    className="object-cover"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                        const fallback = target.parentElement?.querySelector('.flag-fallback') as HTMLElement;
                                                        if (fallback) fallback.style.display = 'flex';
                                                    }}
                                                />
                                                <div className="flag-fallback hidden absolute inset-0 bg-accent rounded-lg-sm text-[8px] font-bold items-center justify-center">
                                                    {city.code}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-2 rounded-lg bg-accent/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                                <MapPin className="h-4 w-4" />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-sm leading-tight text-foreground truncate group-hover:text-primary transition-colors">{city.name}</p>
                                            <p className="text-xs text-muted-foreground">{city.percentage.toFixed(1)}% of Traffic</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-sm leading-tight text-foreground">{(city.count || 0).toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">Visitors</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {geoTab === 'continents' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                            {displayData?.continents?.map((continent, index) => (
                                <div key={continent.name} className="flex items-center justify-between py-3 border-b border-border/40 hover:bg-accent/5 transition-colors group px-1">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <span className="text-[10px] font-bold text-muted-foreground/30 w-4">{(index + 1).toString().padStart(2, '0')}</span>
                                        <div className="p-2 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent hover:scale-110 transition-all duration-300" >
                                            <div className="text-lg">{getContinentEmoji(continent.name)}</div>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-sm leading-tight text-foreground truncate group-hover:text-primary transition-colors">{continent.name}</p>
                                            <p className="text-xs text-muted-foreground">{continent.percentage.toFixed(1)}% of Traffic</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-sm leading-tight text-foreground">{(continent.count || 0).toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">Visitors</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}