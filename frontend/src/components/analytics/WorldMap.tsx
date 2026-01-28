'use client';

import { MouseEvent, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { getCountryCoordinates, getCountryCode, getStandardCountryName } from '@/utils/countries';

interface CountryData {
    name: string;
    count: number;
    percentage: number;
}

interface GeographyProperties {
    name: string;
    [key: string]: any;
}

interface GeographyObject {
    rsmKey: string;
    properties: GeographyProperties;
    [key: string]: any;
}

interface WorldMapProps {
    data?: CountryData[];
    isLoading?: boolean;
    className?: string;
}

// Note: Country data now imported from utils/countries.ts
// This provides comprehensive coverage of all 194 UN member states




export default function WorldMap({ data = [], isLoading = false, className = '' }: WorldMapProps) {
    const [tooltip, setTooltip] = useState<{
        show: boolean;
        x: number;
        y: number;
        content: {
            name: string;
            count?: number;
            percentage?: number;
        };
    }>({
        show: false,
        x: 0,
        y: 0,
        content: { name: '' }
    });


    if (isLoading) {
        return (
            <div className={`h-[32rem] bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 rounded flex items-center justify-center ${className}`}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-sm text-gray-500">Loading geographic data...</p>
                </div>
            </div>
        );
    }

    // If no data, show empty state
    if (!data || data.length === 0) {
        return (
            <div className={`h-[32rem] bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 rounded flex items-center justify-center ${className}`}>
                <div className="text-center">
                    <div className="text-6xl mb-4">🗺️</div>
                    <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No Geographic Data</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Map will appear when visitor data is available</p>
                </div>
            </div>
        );
    }

    // Get color based on visitor count
    const getCountryColor = (countryName: string): string => {
        const country = data.find(d => d.name === countryName);

        if (!country) return '#3a3e44ff'; // Gray for no data

        const maxCount = Math.max(...data.map(d => d.count));
        const intensity = country.count / maxCount;

        if (intensity > 0.8) return '#DC2626'; // Red
        if (intensity > 0.6) return '#EA580C'; // Orange
        if (intensity > 0.4) return '#D97706'; // Amber
        if (intensity > 0.2) return '#059669'; // Emerald
        return '#3B82F6'; // Blue
    };

    // Get marker size based on visitor count
    const getMarkerSize = (count: number): number => {
        const maxCount = Math.max(...data.map(d => d.count));
        const intensity = count / maxCount;
        return Math.max(4, Math.min(20, intensity * 20));
    };

    return (
        <div className={`h-[30rem] rounded overflow-hidden relative ${className}`}>
            {/* Header */}
            {/* <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">World Visitor Map</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {data.length} countries
                    </span>
                </div>
            </div> */}

            {/* Map */}
            <div className="h-full">
                <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{
                        scale: 120,
                        center: [0, 20]
                    }}
                    width={800}
                    height={400}
                    style={{ width: '100%', height: '100%' }}
                >
                    <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json">
                        {({ geographies }: { geographies: GeographyObject[] }) => {
                            return geographies.map((geo: GeographyObject) => {
                                // Map geography names using the comprehensive utils mapping
                                const geoName = geo.properties.name;
                                const countryName = getStandardCountryName(geoName);


                                const countryData = data.find(d => d.name === countryName);
                                const hasData = !!countryData;

                                return (
                                    <Geography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        fill={getCountryColor(countryName || '')}
                                        stroke="#FFFFFF"
                                        strokeWidth={0.5}
                                        style={{
                                            default: {
                                                outline: 'none',
                                            },
                                            hover: {
                                                fill: hasData ? '#F59E0B' : '#a6b1c8ff',
                                                outline: 'none',
                                                cursor: hasData ? 'pointer' : 'default'
                                            },
                                            pressed: {
                                                outline: 'none',
                                            },
                                        }}
                                        onMouseEnter={(event: MouseEvent<SVGPathElement>) => {
                                            setTooltip({
                                                show: true,
                                                x: event.clientX + 15,
                                                y: event.clientY - 60,
                                                content: {
                                                    name: countryName || geo.properties.name || 'Unknown Country',
                                                    count: countryData?.count,
                                                    percentage: countryData?.percentage
                                                }
                                            });
                                        }}
                                        onMouseMove={(event: MouseEvent<SVGPathElement>) => {
                                            setTooltip(prev => ({
                                                ...prev,
                                                x: event.clientX + 15,
                                                y: event.clientY - 60
                                            }));
                                        }}
                                        onMouseLeave={() => {
                                            setTooltip(prev => ({ ...prev, show: false }));
                                        }}
                                    />
                                );
                            });
                        }}
                    </Geographies>

                    {/* Removed circle markers - using country coloring instead */}
                </ComposableMap>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded shadow-lg p-3 z-10">
                <h4 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">Visitor Distribution</h4>
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full bg-red-600"></div>
                        <span className="text-gray-600 dark:text-gray-400">High (80%+)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full bg-orange-600"></div>
                        <span className="text-gray-600 dark:text-gray-400">Medium-High (60-80%)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full bg-amber-600"></div>
                        <span className="text-gray-600 dark:text-gray-400">Medium (40-60%)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
                        <span className="text-gray-600 dark:text-gray-400">Low-Medium (20-40%)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                        <span className="text-gray-600 dark:text-gray-400">Low (0-20%)</span>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded shadow-lg p-3 z-10">
                <div className="text-xs space-y-1">
                    <div className="text-gray-600 dark:text-gray-400">Total Visitors:</div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {data.reduce((sum, country) => sum + country.count, 0).toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Custom Tooltip */}
            {tooltip.show && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y,
                    }}
                >
                    <div className="bg-gray-900 dark:bg-gray-800 text-white px-3 py-2 rounded shadow-xl border border-gray-700 max-w-xs">
                        <div className="font-semibold text-sm mb-1">{tooltip.content.name}</div>
                        {tooltip.content.count !== undefined && (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-300">Visitors:</span>
                                    <span className="font-medium text-blue-300">{tooltip.content.count.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-300">Share:</span>
                                    <span className="font-medium text-green-300">{tooltip.content.percentage?.toFixed(1)}%</span>
                                </div>
                            </div>
                        )}
                        {tooltip.content.count === undefined && (
                            <div className="text-xs text-gray-400">No visitor data</div>
                        )}
                        {/* Tooltip arrow */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                            <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
