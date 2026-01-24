'use client';

import React from 'react';
import { 
  CalendarIcon, 
  Download, 
  Filter, 
  ChevronDown, 
  X, 
  Globe, 
  PlusCircle,
  Clock,
  Calendar as CalendarLucide
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DashboardFiltersProps {
  websiteId: string;
  websites: any[];
  currentWebsite: any;
  dateRange: number;
  onDateRangeChange: (range: number | 'custom') => void;
  customStartDate?: Date;
  customEndDate?: Date;
  onCustomDateChange: (start?: Date, end?: Date) => void;
  isCustomRange: boolean;
  onWebsiteChange: (id: string) => void;
  onExport: () => void;
  isLoading?: boolean;
}

export function DashboardFilters({
  websiteId,
  websites,
  currentWebsite,
  dateRange,
  onDateRangeChange,
  customStartDate,
  customEndDate,
  onCustomDateChange,
  isCustomRange,
  onWebsiteChange,
  onExport,
  isLoading
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-col space-y-4 mb-8 sticky top-0 z-30 bg-background/80 backdrop-blur-md py-4 border-b -mx-4 px-4 sm:-mx-8 sm:px-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Analytics Overview
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Real-time insights for {currentWebsite?.name || 'Loading...'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Website Switcher */}
          <Select value={websiteId} onValueChange={onWebsiteChange}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 border-none bg-muted/50 hover:bg-muted font-semibold shadow-none">
              <div className="flex items-center truncate">
                <Globe className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate text-xs">{currentWebsite?.name || 'Select Website'}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {websites.map((site) => (
                <SelectItem key={site.id} value={site.id} className="text-xs font-medium">
                  {site.name}
                </SelectItem>
              ))}
              <div className="h-px bg-border my-1" />
              <SelectItem value="add-new" className="text-primary text-xs font-bold">
                <div className="flex items-center">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Website
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="h-6 w-px bg-border hidden sm:block" />

          {/* Date Range Selector */}
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
            <Select value={isCustomRange ? 'custom' : dateRange.toString()} onValueChange={(v) => onDateRangeChange(v === 'custom' ? 'custom' : parseInt(v))}>
              <SelectTrigger className="h-9 border-none bg-transparent hover:bg-muted/50 font-bold shadow-none px-3 min-w-[130px]">
                <div className="flex items-center text-xs">
                  <CalendarLucide className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Select Range" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="text-xs font-medium">Today</SelectItem>
                <SelectItem value="2" className="text-xs font-medium">Yesterday</SelectItem>
                <SelectItem value="7" className="text-xs font-medium">Last 7 days</SelectItem>
                <SelectItem value="30" className="text-xs font-medium">Last 30 days</SelectItem>
                <SelectItem value="90" className="text-xs font-medium">Last 90 days</SelectItem>
                <SelectItem value="365" className="text-xs font-medium">Last 12 months</SelectItem>
                <div className="h-px bg-border my-1" />
                <SelectItem value="custom" className="text-xs font-bold text-primary">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {isCustomRange && (
               <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-bold hover:bg-background/80">
                    {customStartDate && customEndDate ? (
                      `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d')}`
                    ) : (
                      'Pick Dates'
                    )}
                    <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customStartDate}
                    selected={{ from: customStartDate, to: customEndDate }}
                    onSelect={(range) => onCustomDateChange(range?.from, range?.to)}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="h-6 w-px bg-border hidden sm:block" />

          {/* More Filters Toggle */}
          <Button variant="ghost" size="sm" className="h-10 px-3 bg-muted/30 hover:bg-muted font-bold text-xs gap-2">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters</span>
            <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">0</Badge>
          </Button>

          {/* Export */}
          <Button variant="ghost" size="icon" className="h-10 w-10 bg-muted/30 hover:bg-muted" onClick={onExport} title="Export Report">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Property Filters (Horizontal Bar) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
        <FilterShortcut label="Country" />
        <FilterShortcut label="Browser" />
        <FilterShortcut label="Device" />
        <FilterShortcut label="Source" />
        <FilterShortcut label="Path" />
      </div>
    </div>
  );
}

function FilterShortcut({ label }: { label: string }) {
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="h-7 text-[10px] font-bold uppercase tracking-wider px-3 rounded-full border-muted-foreground/20 hover:bg-muted transition-all bg-background/50"
    >
      {label}
      <ChevronDown className="ml-1 h-3 w-3 opacity-30" />
    </Button>
  );
}
