'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Download, Filter, Globe, Monitor, Search, Share2, Shield, X, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FilterModalProps {
  dateRange: number;
  isCustomRange: boolean;
  customStartDate?: Date;
  customEndDate?: Date;
  onDateRangeChange: (value: string) => void;
  onCustomDateChange: (start: Date | undefined, end: Date | undefined) => void;
  onFiltersChange?: (filters: any) => void;
  activeFiltersCount?: number;
}

export function FilterModal({
  dateRange,
  isCustomRange,
  customStartDate,
  customEndDate,
  onDateRangeChange,
  onCustomDateChange,
  onFiltersChange,
  activeFiltersCount = 0
}: FilterModalProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('time');
  
  // Advanced Filter State (Mock for UI)
  const [filters, setFilters] = useState({
    country: 'all',
    device: 'all',
    browser: 'all',
    source: 'all',
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    const defaultFilters = {
      country: 'all',
      device: 'all',
      browser: 'all',
      source: 'all',
    };
    setFilters(defaultFilters);
    if (onFiltersChange) onFiltersChange({});
  };

  const applyFilters = () => {
    if (onFiltersChange) {
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== 'all')
      );
      onFiltersChange(activeFilters);
    }
    setOpen(false);
  };

  const totalActiveFilters = activeFiltersCount + Object.values(filters).filter(v => v !== 'all').length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 px-4 bg-card/50 backdrop-blur-md hover:bg-card transition-all rounded shadow-sm font-bold text-xs uppercase tracking-widest gap-2 relative border border-border/50 active:scale-95 text-foreground">
          <Filter className="h-3.5 w-3.5 text-primary" />
          Filter
          {totalActiveFilters > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-black shadow-lg shadow-primary/20">
              {totalActiveFilters}
            </span>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[650px] rounded-3xl border border-border/10 bg-background shadow-2xl p-0 overflow-hidden outline-none">
        <div className="flex flex-col h-[520px]">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-border/10 bg-muted/5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-black tracking-tight text-foreground">
                  Advanced Filters
                </DialogTitle>
                <p className="text-xs font-medium text-muted-foreground">
                  Fine-tune your analytics view
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-44 border-r border-border/10 bg-muted/20 p-3 space-y-1">
              <button
                onClick={() => setActiveTab('time')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200",
                  activeTab === 'time' 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <CalendarIcon size={14} />
                Time Period
              </button>
              <button
                onClick={() => setActiveTab('audience')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200",
                  activeTab === 'audience' 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Globe size={14} />
                Audience
              </button>
              <button
                onClick={() => setActiveTab('technology')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200",
                  activeTab === 'technology' 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Monitor size={14} />
                Technology
              </button>
              <button
                onClick={() => setActiveTab('acquisition')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200",
                  activeTab === 'acquisition' 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Share2 size={14} />
                Acquisition
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'time' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Selection Mode</label>
                    <Select 
                      value={isCustomRange ? 'custom' : dateRange.toString()} 
                      onValueChange={(val) => {
                        onDateRangeChange(val);
                      }}
                    >
                      <SelectTrigger className="w-full h-12 bg-background border-border/20 hover:border-primary/50 transition-all rounded-xl text-sm font-bold shadow-sm">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/10 bg-popover shadow-2xl">
                        <SelectItem value="1" className="rounded-lg">Today</SelectItem>
                        <SelectItem value="7" className="rounded-lg">Last 7 days</SelectItem>
                        <SelectItem value="30" className="rounded-lg">Last 30 days</SelectItem>
                        <SelectItem value="90" className="rounded-lg">Last 90 days</SelectItem>
                        <SelectItem value="custom" className="text-primary font-bold rounded-lg border-t border-border/10 mt-1">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isCustomRange && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-500">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Custom Calendar</label>
                      <div className="p-1 rounded-2xl border border-border/10 bg-muted/5 overflow-hidden">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={customStartDate}
                          selected={{ from: customStartDate, to: customEndDate }}
                          onSelect={(range) => { onCustomDateChange(range?.from, range?.to); }}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'audience' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Country Visibility</label>
                    <Select value={filters.country} onValueChange={(v) => handleFilterChange('country', v)}>
                      <SelectTrigger className="w-full h-12 bg-background border-border/20 hover:border-primary/50 transition-all rounded-xl font-bold shadow-sm">
                        <SelectValue placeholder="All Countries" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/10 bg-popover shadow-2xl">
                        <SelectItem value="all">All Countries</SelectItem>
                        <SelectItem value="us">United States</SelectItem>
                        <SelectItem value="gb">United Kingdom</SelectItem>
                        <SelectItem value="de">Germany</SelectItem>
                        <SelectItem value="fr">France</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {activeTab === 'technology' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Device Category</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['all', 'desktop', 'mobile', 'tablet'].map((d) => (
                        <button
                          key={d}
                          onClick={() => handleFilterChange('device', d)}
                          className={cn(
                            "px-4 py-4 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-sm",
                            filters.device === d 
                              ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]" 
                              : "bg-background border-border/10 text-muted-foreground hover:bg-muted/40 hover:border-border/30"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'acquisition' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Traffic Source</label>
                    <Select value={filters.source} onValueChange={(v) => handleFilterChange('source', v)}>
                      <SelectTrigger className="w-full h-12 bg-background border-border/20 hover:border-primary/50 rounded-xl font-bold shadow-sm">
                        <SelectValue placeholder="Direct / Organic" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/10 bg-popover shadow-2xl">
                        <SelectItem value="all">All Traffic</SelectItem>
                        <SelectItem value="direct">Direct</SelectItem>
                        <SelectItem value="google">Google Search</SelectItem>
                        <SelectItem value="social">Social Media</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border/10 bg-muted/5 flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={resetFilters}
              className="h-9 px-4 rounded-xl font-bold text-xs text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-all gap-2"
            >
              <Trash2 size={14} />
              Reset All
            </Button>
            
            <Button 
              onClick={applyFilters}
              className="h-10 px-8 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-2"
            >
              <CheckCircle2 size={16} />
              Apply Filters
            </Button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[120px] -mr-32 -mt-32 rounded-full pointer-events-none animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 blur-[120px] -ml-32 -mb-32 rounded-full pointer-events-none animate-pulse" />
      </DialogContent>
    </Dialog>
  );
}
