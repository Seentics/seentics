'use client';

import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface TopCountriesChartProps {
  data?: {
    top_countries: Array<{
      country: string;
      visitors: number;
      page_views: number;
      avg_session_duration: number;
    }>;
  };
  isLoading?: boolean;
  onViewMore?: () => void;
}

export function TopCountriesChart({ data, isLoading, onViewMore }: TopCountriesChartProps) {
  // Country name to ISO code mapping
  const getCountryCode = (countryName: string): string => {
    const countryMap: Record<string, string> = {
      'United States': 'US',
      'United States of America': 'US',
      'USA': 'US',
      'US': 'US',
      'Bangladesh': 'BD',
      'India': 'IN',
      'China': 'CN',
      'United Kingdom': 'GB',
      'UK': 'GB',
      'Germany': 'DE',
      'France': 'FR',
      'Canada': 'CA',
      'Australia': 'AU',
      'Japan': 'JP',
      'Brazil': 'BR',
      'Russia': 'RU',
      'South Korea': 'KR',
      'Italy': 'IT',
      'Spain': 'ES',
      'Netherlands': 'NL',
      'Sweden': 'SE',
      'Norway': 'NO',
      'Denmark': 'DK',
      'Finland': 'FI',
      'Switzerland': 'CH',
      'Austria': 'AT',
      'Belgium': 'BE',
      'Poland': 'PL',
      'Czech Republic': 'CZ',
      'Hungary': 'HU',
      'Romania': 'RO',
      'Bulgaria': 'BG',
      'Greece': 'GR',
      'Portugal': 'PT',
      'Ireland': 'IE',
      'New Zealand': 'NZ',
      'Singapore': 'SG',
      'Malaysia': 'MY',
      'Thailand': 'TH',
      'Vietnam': 'VN',
      'Indonesia': 'ID',
      'Philippines': 'PH',
      'Pakistan': 'PK',
      'Sri Lanka': 'LK',
      'Nepal': 'NP',
      'Myanmar': 'MM',
      'Cambodia': 'KH',
      'Laos': 'LA',
      'Mongolia': 'MN',
      'Kazakhstan': 'KZ',
      'Uzbekistan': 'UZ',
      'Kyrgyzstan': 'KG',
      'Tajikistan': 'TJ',
      'Turkmenistan': 'TM',
      'Afghanistan': 'AF',
      'Iran': 'IR',
      'Iraq': 'IQ',
      'Syria': 'SY',
      'Lebanon': 'LB',
      'Jordan': 'JO',
      'Israel': 'IL',
      'Palestine': 'PS',
      'Egypt': 'EG',
      'Libya': 'LY',
      'Tunisia': 'TN',
      'Algeria': 'DZ',
      'Morocco': 'MA',
      'Sudan': 'SD',
      'South Sudan': 'SS',
      'Ethiopia': 'ET',
      'Somalia': 'SO',
      'Kenya': 'KE',
      'Uganda': 'UG',
      'Tanzania': 'TZ',
      'Rwanda': 'RW',
      'Burundi': 'BI',
      'Democratic Republic of the Congo': 'CD',
      'Congo': 'CG',
      'Central African Republic': 'CF',
      'Chad': 'TD',
      'Niger': 'NE',
      'Nigeria': 'NG',
      'Cameroon': 'CM',
      'Gabon': 'GA',
      'Equatorial Guinea': 'GQ',
      'Sao Tome and Principe': 'ST',
      'Angola': 'AO',
      'Zambia': 'ZM',
      'Zimbabwe': 'ZW',
      'Botswana': 'BW',
      'Namibia': 'NA',
      'South Africa': 'ZA',
      'Lesotho': 'LS',
      'Eswatini': 'SZ',
      'Madagascar': 'MG',
      'Comoros': 'KM',
      'Mauritius': 'MU',
      'Seychelles': 'SC',
      'Mexico': 'MX',
      'Guatemala': 'GT',
      'Belize': 'BZ',
      'El Salvador': 'SV',
      'Honduras': 'HN',
      'Nicaragua': 'NI',
      'Costa Rica': 'CR',
      'Panama': 'PA',
      'Colombia': 'CO',
      'Venezuela': 'VE',
      'Guyana': 'GY',
      'Suriname': 'SR',
      'French Guiana': 'GF',
      'Ecuador': 'EC',
      'Peru': 'PE',
      'Bolivia': 'BO',
      'Paraguay': 'PY',
      'Uruguay': 'UY',
      'Argentina': 'AR',
      'Chile': 'CL'
    };

    // Try exact match first
    if (countryMap[countryName]) {
      return countryMap[countryName];
    }

    // Try partial match for common variations
    const lowerCountry = countryName.toLowerCase();
    for (const [key, value] of Object.entries(countryMap)) {
      if (lowerCountry.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerCountry)) {
        return value;
      }
    }

    // Default fallback
    return 'UN';
  };

  // Use real data if available, otherwise show empty state
  const countryData = data?.top_countries?.map((item, index) => {
    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];
    const totalVisitors = data.top_countries.reduce((sum, c) => sum + c.visitors, 0);
    const percentage = totalVisitors > 0 ? Math.round((item.visitors / totalVisitors) * 100) : 0;
    const countryCode = getCountryCode(item.country);

    return {
      country: item.country,
      countryCode: countryCode,
      visitors: item.visitors,
      flag: `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`,
      color: colors[index % colors.length],
      percentage: percentage
    };
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded border border-border/20">
            <div className="flex items-center gap-4">
              <Skeleton className="w-8 h-6 rounded" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="space-y-2 text-right">
                    <Skeleton className="h-4 w-12 ml-auto" />
                    <Skeleton className="h-3 w-8 ml-auto" />
                </div>
                <Skeleton className="w-16 h-2 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data?.top_countries || data.top_countries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 bg-accent/5 rounded border border-dashed border-border/60">
        <Globe className="h-10 w-10 mb-2 opacity-20" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">No country data</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
        {countryData.slice(0, 5).map((item, index) => (
        <div key={item.country} className="flex items-center justify-between p-3 rounded border border-transparent transition-all duration-300 hover:bg-accent/5 hover:border-border/40 group">
            <div className="flex items-center gap-4">
                <div className="relative w-8 h-6 rounded overflow-hidden shadow-sm border border-border/20">
                <Image
                    src={item.flag}
                    alt={`${item.country} flag`}
                    fill
                    className="object-cover"
                    onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const countryCode = item.countryCode.toLowerCase();
                    if (target.src.includes('flagcdn.com')) {
                        target.src = `https://restcountries.eu/data/${countryCode}.svg`;
                    } else {
                        target.style.display = 'none';
                        const fallback = target.parentElement?.querySelector('.flag-fallback') as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                    }
                    }}
                />
                <div className="flag-fallback hidden absolute inset-0 bg-accent rounded text-[8px] font-black items-center justify-center">
                    {item.countryCode}
                </div>
                </div>
                <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight text-foreground truncate">{item.country}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider opacity-50">{item.countryCode}</p>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="text-right">
                    <p className="font-bold text-sm leading-tight">{(item.visitors || 0).toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-40 tracking-wider font-mono">{item.percentage}%</p>
                </div>
                <div className="w-16 h-1.5 bg-accent/20 rounded-full overflow-hidden shrink-0">
                <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.color
                    }}
                />
                </div>
            </div>
        </div>
        ))}
    </div>
  );
}