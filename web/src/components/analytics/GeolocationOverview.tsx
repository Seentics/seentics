'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNumber } from '@/lib/analytics-api';
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
        <div className="h-[32rem] rounded flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
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
}

export function GeolocationOverview({ data, isLoading = false, className = '' }: GeolocationOverviewProps) {
    const [geoTab, setGeoTab] = useState<string>('map');

    const displayData = data;

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
            <Card className={cn("border border-border/60 bg-card shadow-sm rounded overflow-hidden mb-6", className)}>
                <CardHeader>
                    <div className="animate-pulse space-y-2">
                        <div className="h-6 bg-accent/10 rounded w-48 mb-2"></div>
                        <div className="h-4 bg-accent/10 rounded w-64"></div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="animate-pulse h-[400px] bg-accent/5 rounded" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("border border-border/60 bg-card shadow-sm overflow-hidden", className)}>
            <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-border/40">
                <div className="space-y-1">
                    <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                        Geographic Intelligence
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Visitor distribution across global regions</p>
                </div>
                <Tabs value={geoTab} onValueChange={setGeoTab} className="w-full lg:w-auto">
                    <TabsList className="grid w-full grid-cols-3 h-9 bg-accent/10 p-1 rounded">
                        <TabsTrigger className='text-xs font-medium rounded active:bg-background' value="map">Map</TabsTrigger>
                        <TabsTrigger className='text-xs font-medium rounded active:bg-background' value="countries">Countries</TabsTrigger>
                        <TabsTrigger className='text-xs font-medium rounded active:bg-background' value="cities">Cities</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent className="p-6 pt-6">
                <div className="min-h-[400px]">
                    {geoTab === 'map' && (
                        <div className="h-[450px]  relative rounded overflow-hidden ">
                            <WorldMap
                                data={displayData?.countries || []}
                                isLoading={isLoading}
                            />
                        </div>
                    )}

                    {geoTab === 'countries' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                            {displayData?.countries?.slice(0, 14).map((country, index) => (
                                <div key={country.name} className="flex items-center justify-between py-3 border-b border-border/40 hover:bg-accent/5 transition-colors group px-1">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <span className="text-[10px] font-bold text-muted-foreground/30 w-4">{(index + 1).toString().padStart(2, '0')}</span>
                                        <div className="relative w-8 h-6 rounded-sm overflow-hidden shadow-sm border border-border/40">
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
                                            <div className="flag-fallback hidden absolute inset-0 bg-accent rounded-sm text-[8px] font-bold items-center justify-center">
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
                            {displayData?.cities?.slice(0, 14).map((city, index) => (
                                <div key={city.name} className="flex items-center justify-between py-3 border-b border-border/40 hover:bg-accent/5 transition-colors group px-1">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <span className="text-[10px] font-bold text-muted-foreground/30 w-4">{(index + 1).toString().padStart(2, '0')}</span>
                                        <div className="p-2 rounded bg-accent/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300" >
                                            <MapPin className="h-4 w-4" />
                                        </div>
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
                                        <div className="p-2 rounded bg-accent/10 flex items-center justify-center group-hover:bg-accent hover:scale-110 transition-all duration-300" >
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

                    {/* Empty State */}
                    {!displayData?.countries?.length && !isLoading && (
                        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/40 bg-accent/5 rounded border border-dashed border-border/60">
                            <Globe className="h-16 w-16 mb-4 opacity-10" />
                            <div className="text-sm font-medium text-muted-foreground mb-2">No data recorded</div>
                            <div className="text-xs text-muted-foreground/60">Global insights will appear as visitors connect</div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}