'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Monitor, Smartphone, Tablet, Globe, Users, TrendingUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuickFiltersState {
  device?: 'desktop' | 'mobile' | 'tablet';
  country?: string;
  trafficSource?: 'direct' | 'referral' | 'social' | 'search';
  visitorType?: 'new' | 'returning';
}

interface QuickFiltersProps {
  filters: QuickFiltersState;
  onFiltersChange: (filters: QuickFiltersState) => void;
}

export function QuickFilters({ filters, onFiltersChange }: QuickFiltersProps) {
  const activeFiltersCount = Object.keys(filters).filter(key => filters[key as keyof QuickFiltersState]).length;

  const updateFilter = (key: keyof QuickFiltersState, value: string | undefined) => {
    const newFilters = { ...filters };
    if (value === undefined || value === filters[key]) {
      delete newFilters[key];
    } else {
      newFilters[key] = value as any;
    }
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <>
      {/* Device Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={filters.device ? 'default' : 'outline'} 
            size="sm" 
            className={cn(
              'gap-2 h-9 font-medium text-xs shrink-0',
              filters.device && 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
            )}
          >
            {filters.device === 'mobile' && <Smartphone className="h-3.5 w-3.5" />}
            {filters.device === 'desktop' && <Monitor className="h-3.5 w-3.5" />}
            {filters.device === 'tablet' && <Tablet className="h-3.5 w-3.5" />}
            {!filters.device && <Monitor className="h-3.5 w-3.5" />}
            {filters.device ? filters.device.charAt(0).toUpperCase() + filters.device.slice(1) : 'Device'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider">Device Type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => updateFilter('device', 'desktop')}>
            <Monitor className="h-4 w-4 mr-2" />
            Desktop
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateFilter('device', 'mobile')}>
            <Smartphone className="h-4 w-4 mr-2" />
            Mobile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateFilter('device', 'tablet')}>
            <Tablet className="h-4 w-4 mr-2" />
            Tablet
          </DropdownMenuItem>
          {filters.device && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => updateFilter('device', undefined)} className="text-muted-foreground">
                Clear Filter
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Traffic Source Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={filters.trafficSource ? 'default' : 'outline'} 
            size="sm" 
            className={cn(
              'gap-2 h-9 font-medium text-xs shrink-0',
              filters.trafficSource && 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            {filters.trafficSource ? filters.trafficSource.charAt(0).toUpperCase() + filters.trafficSource.slice(1) : 'Source'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider">Traffic Source</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => updateFilter('trafficSource', 'direct')}>
            Direct
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateFilter('trafficSource', 'referral')}>
            Referral
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateFilter('trafficSource', 'social')}>
            Social
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateFilter('trafficSource', 'search')}>
            Search
          </DropdownMenuItem>
          {filters.trafficSource && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => updateFilter('trafficSource', undefined)} className="text-muted-foreground">
                Clear Filter
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Visitor Type Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={filters.visitorType ? 'default' : 'outline'} 
            size="sm" 
            className={cn(
              'gap-2 h-9 font-medium text-xs shrink-0',
              filters.visitorType && 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
            )}
          >
            <Users className="h-3.5 w-3.5" />
            {filters.visitorType ? filters.visitorType.charAt(0).toUpperCase() + filters.visitorType.slice(1) : 'Visitor'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider">Visitor Type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => updateFilter('visitorType', 'new')}>
            New Visitors
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateFilter('visitorType', 'returning')}>
            Returning Visitors
          </DropdownMenuItem>
          {filters.visitorType && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => updateFilter('visitorType', undefined)} className="text-muted-foreground">
                Clear Filter
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear All Button */}
      {activeFiltersCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="gap-2 h-9 text-xs text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-3.5 w-3.5" />
          Clear {activeFiltersCount} {activeFiltersCount === 1 ? 'filter' : 'filters'}
        </Button>
      )}
    </>
  );
}
