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
    <div className="flex flex-col space-y-6 mb-10 sticky top-0 z-30 bg-background/60 backdrop-blur-xl py-6 border-b border-border/40 -mx-4 px-4 sm:-mx-8 sm:px-8 transition-all duration-300">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5 text-foreground">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
              Intelligence Hub
            </h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-60">
              Real-time engine: {currentWebsite?.name || 'Loading...'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Website Switcher */}
          <Select value={websiteId} onValueChange={onWebsiteChange}>
            <SelectTrigger className="w-full sm:w-[200px] h-10 border-border/40 bg-accent/10 hover:bg-accent/20 font-bold shadow-sm rounded px-4 transition-all">
              <div className="flex items-center truncate">
                <Globe className="mr-2.5 h-4 w-4 text-primary shrink-0" />
                <span className="truncate text-[11px] uppercase tracking-wider">{currentWebsite?.name || 'Select Domain'}</span>
              </div>
            </SelectTrigger>
            <SelectContent className="rounded border-border/40 shadow-2xl">
              {websites.map((site) => (
                <SelectItem key={site.id} value={site.id} className="text-xs font-bold py-2.5 px-4 cursor-pointer focus:bg-primary/10 hover:bg-primary/5 transition-colors">
                  {site.name}
                </SelectItem>
              ))}
              <div className="h-px bg-border/40 my-1" />
              <SelectItem value="add-new" className="text-primary text-xs font-black py-2.5 px-4 cursor-pointer">
                <div className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Add Domain
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="h-8 w-px bg-border/40 hidden sm:block" />

          {/* Date Range Selector */}
          <div className="flex items-center bg-accent/10 rounded p-1 border border-border/40">
            <Select value={isCustomRange ? 'custom' : dateRange.toString()} onValueChange={(v) => onDateRangeChange(v === 'custom' ? 'custom' : parseInt(v))}>
              <SelectTrigger className="h-8 border-none bg-transparent hover:bg-accent/10 font-black shadow-none px-3 min-w-[140px] rounded transition-colors">
                <div className="flex items-center text-[10px] uppercase tracking-widest">
                  <CalendarLucide className="mr-2 h-4 w-4 text-primary" />
                  <SelectValue placeholder="Period" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded border-border/40 shadow-2xl">
                <SelectItem value="1" className="text-xs font-bold py-2.5">Today</SelectItem>
                <SelectItem value="2" className="text-xs font-bold py-2.5">Yesterday</SelectItem>
                <SelectItem value="7" className="text-xs font-bold py-2.5">Last 7 days</SelectItem>
                <SelectItem value="30" className="text-xs font-bold py-2.5">Last 30 days</SelectItem>
                <SelectItem value="90" className="text-xs font-bold py-2.5">Last 90 days</SelectItem>
                <SelectItem value="365" className="text-xs font-bold py-2.5">Last 12 months</SelectItem>
                <div className="h-px bg-border/40 my-1" />
                <SelectItem value="custom" className="text-xs font-black text-primary py-2.5">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {isCustomRange && (
               <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] font-black uppercase tracking-wider hover:bg-accent/20 ml-1 rounded">
                    {customStartDate && customEndDate ? (
                      `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d')}`
                    ) : (
                      'Pick Dates'
                    )}
                    <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded border-border/40 shadow-2xl overflow-hidden" align="end">
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

          <div className="h-8 w-px bg-border/40 hidden sm:block" />

          {/* More Filters Toggle */}
          <Button variant="ghost" size="sm" className="h-10 px-4 bg-accent/10 hover:bg-accent/20 font-black text-[10px] uppercase tracking-widest gap-2.5 rounded border border-border/40 transition-all">
            <Filter className="h-4 w-4 text-primary" />
            <span>Filters</span>
            <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground font-black rounded">0</Badge>
          </Button>

          {/* Export */}
          <Button variant="ghost" size="icon" className="h-10 w-10 bg-accent/10 hover:bg-accent/20 rounded border border-border/40 text-primary transition-all" onClick={onExport} title="Export Report">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Property Filters (Horizontal Bar) */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
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
      className="h-7 text-[10px] font-black uppercase tracking-wider px-3 rounded-full border-border/40 hover:bg-accent/20 transition-all bg-accent/5 text-muted-foreground hover:text-primary"
    >
      {label}
      <ChevronDown className="ml-1 h-3 w-3 opacity-30" />
    </Button>
  );
}
