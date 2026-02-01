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
  activeFiltersCount?: number;
}

export function FilterModal({
  dateRange,
  isCustomRange,
  customStartDate,
  customEndDate,
  onDateRangeChange,
  onCustomDateChange,
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
    setFilters({
      country: 'all',
      device: 'all',
      browser: 'all',
      source: 'all',
    });
  };

  const totalActiveFilters = activeFiltersCount + Object.values(filters).filter(v => v !== 'all').length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 px-4 bg-card/50 backdrop-blur-md hover:bg-card transition-all rounded shadow-sm font-bold text-xs uppercase tracking-widest gap-2 relative border border-border/50 active:scale-95 text-foreground">
          <Filter className="h-3.5 w-3.5 text-primary" />
          Filters
          {totalActiveFilters > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-black shadow-lg shadow-primary/20">
              {totalActiveFilters}
            </span>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[700px] rounded-2xl border border-border/40 bg-card/90 backdrop-blur-2xl shadow-2xl p-0 overflow-hidden outline-none">
        <div className="flex flex-col h-[600px]">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  Advanced Filters
                </DialogTitle>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mt-2">
                  Fine-tune your analytics view
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setOpen(false)}
                className="rounded-full hover:bg-muted text-muted-foreground"
              >
                <X size={18} />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-48 border-r border-border/40 bg-muted/20 p-2 space-y-1">
              <button
                onClick={() => setActiveTab('time')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                  activeTab === 'time' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <CalendarIcon size={14} className={activeTab === 'time' ? "text-primary-foreground" : "text-primary"} />
                Time Period
              </button>
              <button
                onClick={() => setActiveTab('audience')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                  activeTab === 'audience' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Globe size={14} className={activeTab === 'audience' ? "text-primary-foreground" : "text-primary"} />
                Audience
              </button>
              <button
                onClick={() => setActiveTab('technology')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                  activeTab === 'technology' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Monitor size={14} className={activeTab === 'technology' ? "text-primary-foreground" : "text-primary"} />
                Technology
              </button>
              <button
                onClick={() => setActiveTab('acquisition')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                  activeTab === 'acquisition' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Share2 size={14} className={activeTab === 'acquisition' ? "text-primary-foreground" : "text-primary"} />
                Acquisition
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-background/30">
              {activeTab === 'time' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">Selection Mode</label>
                    </div>
                    
                    <Select 
                      value={isCustomRange ? 'custom' : dateRange.toString()} 
                      onValueChange={(val) => {
                        onDateRangeChange(val);
                      }}
                    >
                      <SelectTrigger className="w-full h-12 bg-muted/50 border-border/40 hover:bg-muted/80 transition-all rounded-xl shadow-sm text-sm font-semibold text-foreground">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/40 bg-card text-foreground shadow-2xl">
                        <SelectItem value="1" className="rounded-lg">Today</SelectItem>
                        <SelectItem value="7" className="rounded-lg">Last 7 days</SelectItem>
                        <SelectItem value="30" className="rounded-lg">Last 30 days</SelectItem>
                        <SelectItem value="90" className="rounded-lg">Last 90 days</SelectItem>
                        <SelectItem value="custom" className="text-primary font-bold rounded-lg">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isCustomRange && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Custom Calendar</label>
                      </div>
                      
                      <div className="p-4 rounded-xl border border-border/40 bg-muted/20 backdrop-blur-md">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between text-xs mb-2">
                                <span className="text-muted-foreground font-medium">Selected Range</span>
                                <span className="font-bold text-primary px-2 py-1 bg-primary/10 rounded-lg">
                                    {customStartDate && customEndDate 
                                      ? `${format(customStartDate, 'MMM dd')} - ${format(customEndDate, 'MMM dd')}`
                                      : 'Interactive Picker'
                                    }
                                </span>
                            </div>
                            <div className="bg-background/50 rounded-xl border border-border/40 p-2 overflow-hidden shadow-inner flex justify-center">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={customStartDate}
                                    selected={{ from: customStartDate, to: customEndDate }}
                                    onSelect={(range) => { onCustomDateChange(range?.from, range?.to); }}
                                    className="w-full text-foreground"
                                />
                            </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'audience' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Country Visibility</label>
                    </div>
                    <Select value={filters.country} onValueChange={(v) => handleFilterChange('country', v)}>
                      <SelectTrigger className="w-full h-12 bg-muted/50 border-border/40 hover:bg-muted/80 rounded-xl text-foreground">
                        <SelectValue placeholder="All Countries" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/40">
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
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Device Category</label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {['all', 'desktop', 'mobile', 'tablet'].map((d) => (
                        <button
                          key={d}
                          onClick={() => handleFilterChange('device', d)}
                          className={cn(
                            "px-4 py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all",
                            filters.device === d 
                              ? "bg-primary/20 border-primary text-primary shadow-lg shadow-primary/5" 
                              : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
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
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Traffic Source</label>
                    </div>
                    <Select value={filters.source} onValueChange={(v) => handleFilterChange('source', v)}>
                      <SelectTrigger className="w-full h-12 bg-muted/50 border-border/40 hover:bg-muted/80 rounded-xl text-foreground">
                        <SelectValue placeholder="Direct / Organic" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/40">
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
          <div className="p-6 border-t border-border/40 bg-muted/20 flex items-center justify-between">
            <Button 
              variant="outline" 
              onClick={resetFilters}
              className="h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Reset All
            </Button>
            
            <div className="flex items-center gap-3">
               <Button 
                  onClick={() => setOpen(false)}
                  className="h-10 px-8 rounded-xl bg-primary text-primary-foreground font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
               >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                  Apply Filters
               </Button>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[120px] -mr-32 -mt-32 rounded-full pointer-events-none animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 blur-[120px] -ml-32 -mb-32 rounded-full pointer-events-none animate-pulse" />
      </DialogContent>
    </Dialog>
  );
}
